terraform {
  required_providers {
    databricks = {
      source  = "databricks/databricks"
      version = ">= 1.65.0"
    }
  }
}

provider "databricks" {
  profile = "azure-vm-workspace"
}
