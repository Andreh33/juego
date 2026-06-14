# supabase/

Migraciones SQL, RLS, Auth y guardado en nube (§15, §23).

Vacio por diseno en el Bloque 0. El esquema completo (profiles, scores, run_saves,
unlocks, achievements, daily/weekly seeds) + RLS llegan en el **Bloque 14**.
Migraciones siempre **aditivas y versionadas** (INV-6): nunca `DROP` destructivo de
datos de jugador sin backfill aprobado.
