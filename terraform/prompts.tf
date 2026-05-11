###############################################################################
# Shared prompt text (single source of truth).
# Consumed by both the Knowledge Assistant (instructions) and the code-based
# agent notebook (SYSTEM_PROMPT).
###############################################################################

locals {
  geec_system_prompt = file("${path.module}/prompts/geec_system_prompt.txt")
}
