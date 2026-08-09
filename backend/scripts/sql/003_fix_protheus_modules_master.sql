-- Limpa os módulos incorretos carregados pelo fallback antigo
TRUNCATE TABLE public.protheus_modules_master CASCADE;

-- Ao reiniciar o backend (docker compose restart backend), 
-- o FastAPI detectará que a tabela está vazia e vai inserir a nova lista correta:
-- (1, "SIGAATF"), (2, "SIGACOM"), (4, "SIGAEST"), (5, "SIGAFAT"), (6, "SIGAFIN"), etc.
