BEGIN;

INSERT INTO license_plans (plan_code, plan_name, billing_cycle, query_limit, concurrent_sessions_limit, overage_mode)
VALUES
('trial','Trial','monthly',500,2,'block'),
('standard','Standard','monthly',5000,5,'warn'),
('premium','Premium','monthly',20000,15,'bill')
ON CONFLICT (plan_code) DO NOTHING;

COMMIT;
