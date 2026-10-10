-- Cache auth.uid() once per statement in RLS policy expressions.
-- Supabase Performance Advisor flags direct auth.uid() calls that may be
-- re-evaluated per row. Rewriting them as scalar subqueries preserves policy
-- semantics while allowing PostgreSQL to use an InitPlan.

DO $migration$
DECLARE
  policy record;
  using_expression text;
  check_expression text;
  statement_sql text;
BEGIN
  FOR policy IN
    SELECT schemaname, tablename, policyname, cmd, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (
        COALESCE(qual, '') LIKE '%auth.uid()%'
        OR COALESCE(with_check, '') LIKE '%auth.uid()%'
      )
  LOOP
    using_expression := policy.qual;
    check_expression := policy.with_check;

    IF using_expression IS NOT NULL THEN
      using_expression := replace(using_expression, '( SELECT auth.uid() AS uid)', 'auth.uid()');
      using_expression := replace(using_expression, 'auth.uid()', '(SELECT auth.uid())');
    END IF;

    IF check_expression IS NOT NULL THEN
      check_expression := replace(check_expression, '( SELECT auth.uid() AS uid)', 'auth.uid()');
      check_expression := replace(check_expression, 'auth.uid()', '(SELECT auth.uid())');
    END IF;

    statement_sql := format(
      'ALTER POLICY %I ON %I.%I',
      policy.policyname,
      policy.schemaname,
      policy.tablename
    );

    IF policy.cmd IN ('SELECT', 'UPDATE', 'DELETE', 'ALL')
       AND using_expression IS NOT NULL THEN
      statement_sql := statement_sql || format(' USING (%s)', using_expression);
    END IF;

    IF policy.cmd IN ('INSERT', 'UPDATE', 'ALL')
       AND check_expression IS NOT NULL THEN
      statement_sql := statement_sql || format(' WITH CHECK (%s)', check_expression);
    END IF;

    EXECUTE statement_sql;
  END LOOP;
END
$migration$;
