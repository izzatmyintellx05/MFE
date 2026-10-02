#!/bin/bash
# ==============================================================================
# One-Click Azure Deployment Script for MFE Formwork MR11 System
# Target Azure Tenant: drpradeepsinghmyintellx.onmicrosoft.com
# Target Azure Subscription: 9705dfa8-59ea-40ec-b5ab-f2b89e0c5d43
# ==============================================================================

set -e

# Supabase connection string (Transaction pooler URI with your password) must be set first:
#   export DATABASE_URL="postgresql://..."
: "${DATABASE_URL:?Set DATABASE_URL to your Supabase connection string before running this script}"

TENANT_ID="drpradeepsinghmyintellx.onmicrosoft.com"
SUBSCRIPTION_ID="9705dfa8-59ea-40ec-b5ab-f2b89e0c5d43"
RESOURCE_GROUP="rg-mfe-formwork-prod"
LOCATION="eastus" # You can change this to your preferred region (e.g. southeastasia, centralus)
APP_SERVICE_PLAN="asp-mfe-formwork-prod"
APP_NAME="mfe-mr11-${RANDOM:0:4}" # Must be globally unique across Azure

echo "=========================================================="
echo " Starting Azure Deployment for MFE Formwork MR11 System"
echo " Tenant:       $TENANT_ID"
echo " Subscription: $SUBSCRIPTION_ID"
echo "=========================================================="

# 1. Login to Azure Tenant
echo "==> Step 1: Logging in to Azure Tenant..."
az login --tenant "$TENANT_ID"

# 2. Set Active Subscription
echo "==> Step 2: Selecting Target Subscription..."
az account set --subscription "$SUBSCRIPTION_ID"
echo "Active Subscription: $(az account show --query name -o tsv) ($SUBSCRIPTION_ID)"

# 3. Create Resource Group
echo "==> Step 3: Ensuring Resource Group '$RESOURCE_GROUP' exists in '$LOCATION'..."
az group create --name "$RESOURCE_GROUP" --location "$LOCATION"

# 4. Create App Service Plan (Linux)
echo "==> Step 4: Creating Linux App Service Plan..."
az appservice plan create \
  --name "$APP_SERVICE_PLAN" \
  --resource-group "$RESOURCE_GROUP" \
  --location "$LOCATION" \
  --is-linux \
  --sku B1

# 5. Create Web App (Node 22 LTS)
echo "==> Step 5: Creating Linux Web App '$APP_NAME' with Node 22..."
az webapp create \
  --name "$APP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --plan "$APP_SERVICE_PLAN" \
  --runtime "NODE:22-lts" \
  --startup-file "npm start"

# 6. Configure Application Settings
echo "==> Step 6: Configuring App Settings..."
az webapp config appsettings set \
  --name "$APP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --settings \
    NODE_ENV=production \
    NPM_CONFIG_INCLUDE=dev \
    DATABASE_URL="$DATABASE_URL" \
    JWT_SECRET="mfe-enterprise-jwt-prod-$(openssl rand -hex 16 2>/dev/null || echo '2026secretkey')" \
    SCM_DO_BUILD_DURING_DEPLOYMENT=true \
    AZURE_SUBSCRIPTION_ID="$SUBSCRIPTION_ID" \
    AZURE_TENANT_ID="$TENANT_ID"

# 7. Build and Package Local Project
echo "==> Step 7: Packaging application bundle..."
npm run build
zip -r deploy.zip . \
  -x "node_modules/*" \
  -x ".git/*" \
  -x "coverage/*" \
  -x "deploy.zip"

# 8. Deploy Zip Package to Azure Web App
echo "==> Step 8: Deploying to Azure Web App..."
az webapp deployment source config-zip \
  --name "$APP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --src deploy.zip

rm -f deploy.zip

echo "=========================================================="
echo " Deployment Successfully Completed!"
echo " Web App URL: https://${APP_NAME}.azurewebsites.net"
echo "=========================================================="
