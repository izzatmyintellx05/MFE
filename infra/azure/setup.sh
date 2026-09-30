#!/usr/bin/env bash
# One-time Azure setup for the MFE PoC (region: Malaysia West).
#
# Creates:
#   - Resource group            rg-mfe-prod
#   - PostgreSQL Flexible Server psql-mfe-poc-<id>  (Burstable B1ms, 32 GB, PG 16)
#   - App Service plan          asp-mfe-poc        (B1 Linux)
#   - Web app                   app-mfe-poc-<id>   (Node 22 LTS)
#   - A login for GitHub Actions to deploy the web app (OIDC, no passwords stored)
#
# How to run: open Azure Cloud Shell (Bash), upload this file, then run:  bash setup.sh
# Safe to run again: it reuses what already exists (names do not change between runs).
# Needs: Owner (or Contributor + User Access Administrator) on the subscription,
#        and permission to create app registrations in Microsoft Entra ID.

set -eu

SUBSCRIPTION=31139988-7ba8-4c12-b668-14e236c9c2c7
LOCATION=malaysiawest
RG=rg-mfe-prod
GITHUB_REPO=orapradeep/MFE
GITHUB_BRANCH=main

# 6 characters from the subscription id keep the names unique worldwide and the same on every run
SUFFIX=$(echo -n "$SUBSCRIPTION" | sha1sum | cut -c1-6)
PG_NAME=psql-mfe-poc-$SUFFIX
PG_ADMIN=mfeadmin
PG_DB=mfe
PLAN=asp-mfe-poc
APP_NAME=app-mfe-poc-$SUFFIX
GH_APP_REG=github-mfe-deploy

az account set --subscription "$SUBSCRIPTION"

# ---------- Database password (asked here, never saved in this file) ----------
echo "Database password rules: 8-128 characters, at least 3 of: uppercase, lowercase, number, symbol."
echo "Allowed symbols: . _ ~ * ! -   (other symbols break the connection string)"
read -rsp "Database password: " PG_PASS; echo
if ! [[ "$PG_PASS" =~ ^[A-Za-z0-9._~*!-]{8,128}$ ]]; then
  echo "STOP: password is too short or has a symbol that is not allowed."
  exit 1
fi

# ---------- Check the region has what we need ----------
echo "Checking that $LOCATION offers PostgreSQL B1ms and App Service B1 Linux..."
if ! az postgres flexible-server list-skus --location "$LOCATION" -o json | grep -q Standard_B1ms; then
  echo "STOP: PostgreSQL B1ms is not available in $LOCATION for this subscription."
  exit 1
fi
if ! az appservice list-locations --sku B1 --linux-workers-enabled --query "[].name" -o tsv | grep -qi "malaysia west"; then
  echo "STOP: App Service B1 Linux is not available in $LOCATION for this subscription."
  exit 1
fi
echo "OK"

# ---------- Resource group ----------
az group create --name "$RG" --location "$LOCATION" -o none

# ---------- PostgreSQL ----------
if az postgres flexible-server show -g "$RG" -n "$PG_NAME" -o none 2>/dev/null; then
  echo "PostgreSQL $PG_NAME already exists - setting the password you entered"
  az postgres flexible-server update -g "$RG" -n "$PG_NAME" --admin-password "$PG_PASS" -o none
else
  echo "Creating PostgreSQL $PG_NAME (takes 5-10 minutes)..."
  az postgres flexible-server create \
    --resource-group "$RG" \
    --name "$PG_NAME" \
    --location "$LOCATION" \
    --tier Burstable --sku-name Standard_B1ms \
    --storage-size 32 --storage-auto-grow Disabled \
    --version 16 \
    --high-availability Disabled \
    --backup-retention 7 --geo-redundant-backup Disabled \
    --public-access 0.0.0.0 \
    --admin-user "$PG_ADMIN" --admin-password "$PG_PASS" \
    --database-name "$PG_DB" \
    --yes -o none
fi

# ---------- App Service plan + web app ----------
echo "Creating App Service plan and web app..."
az appservice plan create -g "$RG" -n "$PLAN" --location "$LOCATION" --is-linux --sku B1 -o none
if ! az webapp show -g "$RG" -n "$APP_NAME" -o none 2>/dev/null; then
  az webapp create -g "$RG" -p "$PLAN" -n "$APP_NAME" --runtime "NODE:22-lts" -o none
fi
az webapp update -g "$RG" -n "$APP_NAME" --https-only true -o none
az webapp config set -g "$RG" -n "$APP_NAME" \
  --always-on true --min-tls-version 1.2 --ftps-state Disabled \
  --startup-file "npm run start:azure" -o none
az webapp config set -g "$RG" -n "$APP_NAME" --generic-configurations '{"healthCheckPath": "/health"}' -o none
az webapp log config -g "$RG" -n "$APP_NAME" --docker-container-logging filesystem -o none

# Keep the existing JWT secret on re-runs so users stay logged in
JWT_SECRET=$(az webapp config appsettings list -g "$RG" -n "$APP_NAME" --query "[?name=='JWT_SECRET'].value | [0]" -o tsv)
if [ -z "$JWT_SECRET" ]; then
  JWT_SECRET=$(openssl rand -hex 32)
fi

az webapp config appsettings set -g "$RG" -n "$APP_NAME" -o none --settings \
  DATABASE_URL="postgresql://$PG_ADMIN:$PG_PASS@$PG_NAME.postgres.database.azure.com:5432/$PG_DB?sslmode=require" \
  JWT_SECRET="$JWT_SECRET" \
  JWT_EXPIRES_IN=12h \
  NODE_ENV=production \
  UPLOAD_DIR=/home/data/uploads \
  SCM_DO_BUILD_DURING_DEPLOYMENT=false

# ---------- GitHub Actions login (OIDC) ----------
echo "Setting up GitHub Actions login..."
CLIENT_ID=$(az ad app list --display-name "$GH_APP_REG" --query "[0].appId" -o tsv)
if [ -z "$CLIENT_ID" ]; then
  CLIENT_ID=$(az ad app create --display-name "$GH_APP_REG" --query appId -o tsv)
fi
SP_ID=$(az ad sp list --filter "appId eq '$CLIENT_ID'" --query "[0].id" -o tsv)
if [ -z "$SP_ID" ]; then
  SP_ID=$(az ad sp create --id "$CLIENT_ID" --query id -o tsv)
fi
# Only allowed to deploy this one web app
WEBAPP_ID=$(az webapp show -g "$RG" -n "$APP_NAME" --query id -o tsv)
az role assignment create --assignee-object-id "$SP_ID" --assignee-principal-type ServicePrincipal \
  --role "Website Contributor" --scope "$WEBAPP_ID" -o none
if ! az ad app federated-credential list --id "$CLIENT_ID" --query "[].name" -o tsv | grep -qx github-main; then
  az ad app federated-credential create --id "$CLIENT_ID" -o none --parameters "{
    \"name\": \"github-main\",
    \"issuer\": \"https://token.actions.githubusercontent.com\",
    \"subject\": \"repo:$GITHUB_REPO:ref:refs/heads/$GITHUB_BRANCH\",
    \"audiences\": [\"api://AzureADTokenExchange\"]
  }"
fi
TENANT_ID=$(az account show --query tenantId -o tsv)
HOST=$(az webapp show -g "$RG" -n "$APP_NAME" --query defaultHostName -o tsv)

cat <<EOF

==================== DONE ====================
Web app URL:      https://$HOST
Database server:  $PG_NAME.postgres.database.azure.com

Now add these in GitHub: repo $GITHUB_REPO > Settings > Secrets and variables > Actions
  Secrets tab:
    AZURE_CLIENT_ID        = $CLIENT_ID
    AZURE_TENANT_ID        = $TENANT_ID
    AZURE_SUBSCRIPTION_ID  = $SUBSCRIPTION
  Variables tab:
    AZURE_WEBAPP_NAME      = $APP_NAME
==============================================
EOF
