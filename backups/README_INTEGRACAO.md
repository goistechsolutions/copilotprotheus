# Copilot Protheus - Pacote de Integração Piloto

Este pacote cria a base para integrar o Copilot Protheus ao cenário real do cliente piloto via REST, WebApp e VSCode Server.

## Conteúdo
- Configuração do tenant piloto
- Variáveis de ambiente
- Cliente REST Python
- Script PowerShell para validação
- Script PowerShell para teste de conexão

## Uso
1. Copie a pasta para a máquina de homologação
2. Ajuste `config/pilot.env`
3. Execute `scripts/setup_venv.ps1`
4. Execute `scripts/test_connection.ps1`
5. Execute `scripts/start_backend.ps1`
