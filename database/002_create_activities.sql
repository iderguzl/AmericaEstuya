-- Actividades y datos adicionales de actividad
ALTER TABLE public.igldata DROP CONSTRAINT ck_igldata_applies_to;
ALTER TABLE public.igldata ADD CONSTRAINT ck_igldata_applies_to
CHECK ((applies_to)::text = ANY ((ARRAY['ACCOUNT'::varchar,'CLIENT'::varchar,'USER'::varchar,'ACTIVITY'::varchar,'ALL'::varchar])::text[]));

CREATE TABLE public.activities (
  activity_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  account_id bigint NOT NULL REFERENCES public.accounts(account_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  client_id bigint NOT NULL REFERENCES public.clients(client_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  description text NOT NULL,
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  responsible_client_id bigint NULL REFERENCES public.clients(client_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NULL,
  is_active smallint NOT NULL DEFAULT 1,
  CONSTRAINT ck_activities_dates CHECK (end_at >= start_at),
  CONSTRAINT ck_activities_is_active_state CHECK (is_active = ANY (ARRAY[0,1,2]))
);
CREATE INDEX ix_activities_account ON public.activities(account_id);
CREATE INDEX ix_activities_client ON public.activities(client_id);
CREATE INDEX ix_activities_responsible ON public.activities(responsible_client_id);
CREATE INDEX ix_activities_dates ON public.activities(start_at,end_at);
CREATE INDEX ix_activities_active ON public.activities(is_active);

CREATE TABLE public.activity_data (
  activity_data_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  activity_id bigint NOT NULL REFERENCES public.activities(activity_id) ON UPDATE RESTRICT ON DELETE CASCADE,
  igldata_id bigint NOT NULL REFERENCES public.igldata(id_sequence) ON UPDATE RESTRICT ON DELETE RESTRICT,
  value_text text NULL,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NULL,
  is_active smallint NOT NULL DEFAULT 1,
  CONSTRAINT uq_activity_data UNIQUE(activity_id,igldata_id),
  CONSTRAINT ck_activity_data_is_active_state CHECK (is_active = ANY (ARRAY[0,1,2]))
);
