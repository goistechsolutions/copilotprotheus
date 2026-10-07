-- Bootstrap 05: Seed do catálogo global de módulos Protheus (public.protheus_modules_master)
-- e mapeamento com domínios de negócio (public.business_domain_modules)

BEGIN;

-- 1. Domínios de negócio ERP
INSERT INTO public.business_domains (domain_code, name, description, active) VALUES
  ('FINANCEIRO', 'Financeiro', 'Contas a Receber, Contas a Pagar, Tesouraria e Fluxo de Caixa', true),
  ('VENDAS', 'Vendas e Faturamento', 'Pedidos de Venda, Notas de Saída e Clientes', true),
  ('COMPRAS', 'Compras e Suprimentos', 'Pedidos de Compra, Notas de Entrada e Fornecedores', true),
  ('ESTOQUE', 'Estoque e Custos', 'Saldos, Movimentações e Produtos', true),
  ('FISCAL', 'Livros Fiscais', 'Tributação, Apurações e Obrigações', true),
  ('CONTROLADORIA', 'Controladoria e Contabilidade', 'Plano de Contas e Lançamentos Contábeis', true)
ON CONFLICT (domain_code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  active = EXCLUDED.active;

-- 2. Catálogo global de módulos Protheus (protheus_modules_master)
INSERT INTO public.protheus_modules_master (id, module_sigla, description, active) VALUES
  (1,  'SIGAATF', 'SIGAATF - Ativo Fixo', true),
  (2,  'SIGACOM', 'SIGACOM - Compras / Suprimentos', true),
  (4,  'SIGAEST', 'SIGAEST - Estoque e Custos', true),
  (5,  'SIGAFAT', 'SIGAFAT - Faturamento', true),
  (6,  'SIGAFIN', 'SIGAFIN - Financeiro', true),
  (7,  'SIGAGPE', 'SIGAGPE - Gestão de Pessoal', true),
  (8,  'SIGAMNT', 'SIGAMNT - Manutenção de Ativos', true),
  (9,  'SIGAFIS', 'SIGAFIS - Livros Fiscais', true),
  (10, 'SIGAPCP', 'SIGAPCP - Planejamento e Controle da Produção', true),
  (11, 'SIGACRM', 'SIGACRM - Gestão de Relacionamento (CRM)', true),
  (12, 'SIGAPLN', 'SIGAPLN - Planejamento e Orçamento', true),
  (13, 'SIGAADV', 'SIGAADV - Administração de Vendas', true),
  (14, 'SIGAPEG', 'SIGAPEG - Pecúlio e Pensões', true),
  (15, 'SIGAAGR', 'SIGAAGR - Agronegócio', true),
  (16, 'SIGAPON', 'SIGAPON - Ponto Eletrônico', true),
  (17, 'SIGAMDT', 'SIGAMDT - Medicina e Segurança do Trabalho', true),
  (18, 'SIGAQHT', 'SIGAQHT - Qualidade / Hotelaria', true),
  (19, 'SIGAQMT', 'SIGAQMT - Metrologia', true),
  (20, 'SIGAQDO', 'SIGAQDO - Documentação da Qualidade', true),
  (21, 'SIGAQIP', 'SIGAQIP - Inspeção de Processos', true),
  (22, 'SIGAQIE', 'SIGAQIE - Inspeção de Entradas', true),
  (23, 'SIGAFSP', 'SIGAFSP - Fast Service / Posto de Combustível', true),
  (24, 'SIGAPAT', 'SIGAPAT - Patrimônio / Ativo Fixo', true),
  (25, 'SIGAVEC', 'SIGAVEC - Veículos', true),
  (26, 'SIGAEC',  'SIGAEC - Easy Construction', true),
  (27, 'SIGAACD', 'SIGAACD - Automação Coleta de Dados', true),
  (28, 'SIGATMS', 'SIGATMS - Gestão de Transportes (TMS)', true),
  (29, 'SIGAWMS', 'SIGAWMS - Gestão de Armazém (WMS)', true),
  (30, 'SIGAPMS', 'SIGAPMS - Gestão de Projetos (PMS)', true),
  (31, 'SIGACDB', 'SIGACDB - Código de Barras / Automação', true),
  (32, 'SIGAERM', 'SIGAERM - Risk Management', true),
  (33, 'SIGAEIC', 'SIGAEIC - Easy Import Control (Importação)', true),
  (34, 'SIGACTB', 'SIGACTB - Contabilidade Gerencial', true),
  (35, 'SIGAEFF', 'SIGAEFF - Easy Foreign Finance', true),
  (36, 'SIGAECO', 'SIGAECO - Easy Accounting / Contabilidade Câmbio', true),
  (37, 'SIGAEDC', 'SIGAEDC - Easy Data Collection', true),
  (38, 'SIGAEPO', 'SIGAEPO - Easy Purchase Order', true),
  (39, 'SIGASFC', 'SIGASFC - Shop Floor Control (Chão de Fábrica)', true),
  (40, 'SIGAPLS', 'SIGAPLS - Planos de Saúde', true),
  (41, 'SIGACTL', 'SIGACTL - Controle de Locação', true),
  (42, 'SIGAGVA', 'SIGAGVA - Gestão de Varejo', true),
  (43, 'SIGATAC', 'SIGATAC - Gestão de Acervos / Módulos Especiais', true),
  (44, 'SIGAOMS', 'SIGAOMS - Order Management System', true),
  (45, 'SIGAAMB', 'SIGAAMB - Gestão Ambiental', true),
  (46, 'SIGANCM', 'SIGANCM - Nomenclatura Comum do Mercosul', true),
  (47, 'SIGAGCC', 'SIGAGCC - Gestão de Contratos de Concessão', true),
  (48, 'SIGAGSP', 'SIGAGSP - Gestão do Setor Público', true),
  (49, 'SIGAGTP', 'SIGAGTP - Gestão de Transporte de Passageiros', true),
  (52, 'SIGOFI',  'SIGOFI - Oficina / Concessionárias', true),
  (53, 'SIGATFP', 'SIGATFP - Gestão de Frota / Passagens', true),
  (56, 'SIGAGCV', 'SIGAGCV - Gestão de Cargas e Veículos', true),
  (84, 'SIGACFG', 'SIGACFG - Configurador', true),
  (85, 'SIGAEEC', 'SIGAEEC - Easy Export Control (Exportação)', true),
  (88, 'SIGAESP', 'SIGAESP - Específico / Customizados', true),
  (97, 'SIGAFWD', 'SIGAFWD - Framework / Arquitetura', true)
ON CONFLICT (id) DO UPDATE SET
  module_sigla = EXCLUDED.module_sigla,
  description  = EXCLUDED.description,
  active       = EXCLUDED.active,
  updated_at   = now();

-- 3. Mapeamento canônico de domínios x módulos
INSERT INTO public.business_domain_modules (domain_code, module_id, is_primary) VALUES
  ('FINANCEIRO', 6, true),
  ('VENDAS', 5, true),
  ('COMPRAS', 2, true),
  ('ESTOQUE', 4, true),
  ('FISCAL', 9, true),
  ('CONTROLADORIA', 34, true)
ON CONFLICT (domain_code, module_id) DO UPDATE SET
  is_primary = EXCLUDED.is_primary;

COMMIT;
