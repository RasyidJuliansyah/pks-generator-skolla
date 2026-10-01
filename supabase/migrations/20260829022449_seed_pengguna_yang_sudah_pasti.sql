-- Hanya orang yang perannya sudah ditegaskan Rizki. Sisanya (Head of Sales,
-- Admin Sales, Education, Tech Ops, Service Account) belum diketahui dan sengaja
-- tidak ditebak — tanpa baris di sini mereka tidak bisa melihat apa pun.
insert into pengguna (email, nama, peran) values
  ('rizki@skolla.education', 'Rizki',  '{head_of_operations,admin_utama}'),
  ('akbar@skolla.education', 'Akbar',  '{cbo}'),
  ('farid@skolla.education', 'Farid',  '{finance}'),
  ('dwiva@skolla.education', 'Dwiva',  '{tech_ops_lead}')
on conflict (email) do nothing;
