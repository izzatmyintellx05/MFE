# Azure Connection & Deployment Guide

This guide details how to deploy the **MFE Formwork MR11 System** to your target **Azure Subscription and Tenant**:

- **Azure Tenant**: `drpradeepsinghmyintellx.onmicrosoft.com`
- **Subscription ID**: `9705dfa8-59ea-40ec-b5ab-f2b89e0c5d43`
- **Azure Portal Direct Link**: [https://portal.azure.com/#@drpradeepsinghmyintellx.onmicrosoft.com/resource/subscriptions/9705dfa8-59ea-40ec-b5ab-f2b89e0c5d43/overview](https://portal.azure.com/#@drpradeepsinghmyintellx.onmicrosoft.com/resource/subscriptions/9705dfa8-59ea-40ec-b5ab-f2b89e0c5d43/overview)

---

## 1. Automated Deployment via `deploy-azure.sh`

The repository provides a script [`deploy-azure.sh`](../deploy-azure.sh) that creates the Resource Group, App Service Plan, Web App (Node 22 LTS), configures environment variables, builds the application, and deploys it to your Azure subscription:

```bash
# Execute the automated deployment script:
./deploy-azure.sh
```

The script performs the following actions:
1. Logs into Azure with `--tenant drpradeepsinghmyintellx.onmicrosoft.com`.
2. Activates subscription `9705dfa8-59ea-40ec-b5ab-f2b89e0c5d43`.
3. Creates Resource Group `rg-mfe-formwork-prod`.
4. Creates a Linux App Service Plan (`asp-mfe-formwork-prod`).
5. Creates a Linux Web App running Node 22 LTS.
6. Sets environment variables (`PORT=3000`, `NODE_ENV=production`, `JWT_SECRET`).
7. Packages and deploys the zip bundle directly to Azure App Service.

---

## 2. Deploying via ARM Template (`azuredeploy.json`)

You can also deploy directly from the Azure Portal or Azure CLI using the included ARM template [`azuredeploy.json`](../azuredeploy.json):

### Via Azure CLI:
```bash
az login --tenant drpradeepsinghmyintellx.onmicrosoft.com
az account set --subscription 9705dfa8-59ea-40ec-b5ab-f2b89e0c5d43

az group create --name rg-mfe-formwork-prod --location eastus

az deployment group create \
  --resource-group rg-mfe-formwork-prod \
  --template-file azuredeploy.json \
  --parameters webAppName="mfe-formwork-mr11-app"
```

### Via Azure Portal "Custom Deployment":
1. Open the [Azure Portal Custom Template](https://portal.azure.com/#create/Microsoft.Template).
2. Click **Build your own template in the editor**.
3. Copy and paste the contents of `azuredeploy.json`.
4. Select Subscription `9705dfa8-59ea-40ec-b5ab-f2b89e0c5d43` and click **Review + Create**.

---

## 3. Azure DevOps CI/CD Pipeline (`azure-pipelines.yml`)

The pipeline in [`azure-pipelines.yml`](../azure-pipelines.yml) is pre-configured with:
- `AZURE_SUBSCRIPTION_ID: '9705dfa8-59ea-40ec-b5ab-f2b89e0c5d43'`
- `AZURE_TENANT_ID: 'drpradeepsinghmyintellx.onmicrosoft.com'`

When linked to your Azure DevOps project, pushes to branch `azure-deploy` automatically validate, build, package, and deploy directly to this Azure subscription.

---

## 4. Key Application Settings in Azure

Ensure these environment variables are set in your Azure Web App:

| Setting Key | Value | Purpose |
| :--- | :--- | :--- |
| `PORT` | `3000` | Port Express server listens on |
| `NODE_ENV` | `production` | Enables production optimizations & static asset caching |
| `JWT_SECRET` | `<YOUR_SECRET_STRING>` | Token encryption key |
| `SCM_DO_BUILD_DURING_DEPLOYMENT` | `true` | Tells Kudu to run build script if needed |
| `AZURE_SUBSCRIPTION_ID` | `9705dfa8-59ea-40ec-b5ab-f2b89e0c5d43` | Target Azure Subscription |
| `AZURE_TENANT_ID` | `drpradeepsinghmyintellx.onmicrosoft.com` | Target Azure Tenant |
