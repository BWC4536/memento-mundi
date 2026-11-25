-- 007 · Datos de muestra de la red social (beta). Aplicar DESPUÉS de 006_social.sql.
--
-- Crea:
--   · 12 lugares con su portada (de momento fotos de /public/paisajes; cámbialas cuando tengas las definitivas:
--       update public.social_places set cover_url = 'https://…' where slug = 'panama';)
--   · 6 cuentas de muestra (sin contraseña: nadie puede entrar con ellas) marcadas con
--     raw_app_meta_data.sample = true, y sus publicaciones, likes, comentarios y seguimientos.
--   · Enlaza el scrapbook "Panamá" con el lugar Panamá.
--
-- Para borrar TODAS las muestras (en cascada se van sus posts, likes, comentarios…):
--   delete from auth.users where raw_app_meta_data->>'sample' = 'true';
--
-- Es idempotente: se puede ejecutar varias veces.

-- ── Lugares ──────────────────────────────────────────────────────────────────
insert into public.social_places (slug, name, country, kind, latitude, longitude, cover_url) values
  ('panama',     'Panamá',     'Panamá',       'country', 8.9824,  -79.5199, '/paisajes/web/panama-playa-1080.webp'),
  ('praga',      'Praga',      'Chequia',      'city',    50.0875,  14.4213, '/paisajes/web/praga-puente-carlos-1080.webp'),
  ('viena',      'Viena',      'Austria',      'city',    48.2082,  16.3738, '/paisajes/web/viena-peterskirche-1080.webp'),
  ('budapest',   'Budapest',   'Hungría',      'city',    47.4979,  19.0402, '/paisajes/web/budapest-parlamento-1280.webp'),
  ('bratislava', 'Bratislava', 'Eslovaquia',   'city',    48.1486,  17.1077, '/paisajes/web/bratislava-iglesia-azul-1080.webp'),
  ('venecia',    'Venecia',    'Italia',       'city',    45.4408,  12.3155, '/paisajes/web/venecia-rialto-1080.webp'),
  ('bled',       'Bled',       'Eslovenia',    'city',    46.3683,  14.1146, '/paisajes/web/bled-lago-1080.webp'),
  ('londres',    'Londres',    'Reino Unido',  'city',    51.5007,  -0.1246, '/paisajes/web/londres-big-ben-576.webp'),
  ('alsacia',    'Alsacia',    'Francia',      'region',  48.0794,   7.3585, '/paisajes/web/alsacia-canal-1080.webp'),
  ('lisboa',     'Lisboa',     'Portugal',     'city',    38.7223,  -9.1393, 'https://images.unsplash.com/photo-1555881400-74d7acaacd8b?auto=format&fit=crop&w=1200&q=85'),
  ('kioto',      'Kioto',      'Japón',        'city',    35.0116, 135.7681, 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=1200&q=85'),
  ('alpes',      'Alpes',      'Europa',       'region',  46.5600,   8.5600, '/paisajes/web/alpes-rio-1080.webp')
on conflict (slug) do nothing;

-- El scrapbook "Panamá" de Arturo pertenece al lugar Panamá.
update public.scrapbooks set place_id = (select id from public.social_places where slug = 'panama')
where id = '6fd375b4-99a9-4507-8a4a-e96fc0f8ecfc' and place_id is null;

-- ── Cuentas de muestra ───────────────────────────────────────────────────────
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                        confirmation_token, recovery_token, email_change_token_new, email_change, is_sso_user, is_anonymous)
select '00000000-0000-0000-0000-000000000000', u.id::uuid, 'authenticated', 'authenticated', u.email, '', now(),
       '{"provider":"email","providers":["email"],"sample":true}'::jsonb, jsonb_build_object('name', u.name),
       now() - interval '30 days', now(), '', '', '', '', false, false
from (values
  ('5a1e0000-0000-4000-8000-000000000001', 'memento.mundi@muestra.memento-mundi.invalid', 'Memento Mundi'),
  ('5a1e0000-0000-4000-8000-000000000002', 'lucia.viaja@muestra.memento-mundi.invalid',   'Lucía Ferrer'),
  ('5a1e0000-0000-4000-8000-000000000003', 'marco.enruta@muestra.memento-mundi.invalid',  'Marco Bellini'),
  ('5a1e0000-0000-4000-8000-000000000004', 'noa.mapas@muestra.memento-mundi.invalid',     'Noa Kim'),
  ('5a1e0000-0000-4000-8000-000000000005', 'teo.postales@muestra.memento-mundi.invalid',  'Teo Martín'),
  ('5a1e0000-0000-4000-8000-000000000006', 'ines.ensal@muestra.memento-mundi.invalid',    'Inés Rubio')
) as u(id, email, name)
on conflict (id) do nothing;

-- El trigger handle_new_user ya creó sus perfiles; les damos usuario y bio.
insert into public.profiles (id, username, display_name, bio, is_private)
values
  ('5a1e0000-0000-4000-8000-000000000001', 'memento.mundi', 'Memento Mundi', 'Cuenta oficial. Pegatinas, QRs y recuerdos que vuelven a su sitio ✦', false),
  ('5a1e0000-0000-4000-8000-000000000002', 'lucia.viaja',   'Lucía Ferrer',  'Centroeuropa en tren y a pie. Coleccionista de horas azules.', false),
  ('5a1e0000-0000-4000-8000-000000000003', 'marco.enruta',  'Marco Bellini', 'Veneciano de nacimiento, viajero por despiste.', false),
  ('5a1e0000-0000-4000-8000-000000000004', 'noa.mapas',     'Noa Kim',       'Dibujo mapas de los sitios a los que vuelvo.', false),
  ('5a1e0000-0000-4000-8000-000000000005', 'teo.postales',  'Teo Martín',    'Lagos, montañas y postales escritas a mano.', false),
  ('5a1e0000-0000-4000-8000-000000000006', 'ines.ensal',    'Inés Rubio',    'Sal en el pelo y arena en la mochila. 🌴', false)
on conflict (id) do update set username = excluded.username, display_name = excluded.display_name, bio = excluded.bio, is_private = false;

-- ── Publicaciones ────────────────────────────────────────────────────────────
insert into public.social_posts (id, author_id, place_id, caption, created_at)
select v.id::uuid, v.author::uuid, (select pl.id from public.social_places pl where pl.slug = v.place), v.caption, now() - make_interval(hours => v.hours)
from (values
  ('5b000000-0000-4000-8000-000000000001', '5a1e0000-0000-4000-8000-000000000006', 'panama',     'Agua a 28 grados y una lancha roja esperando. Panamá, no me sueltes. 🌴', 3),
  ('5b000000-0000-4000-8000-000000000002', '5a1e0000-0000-4000-8000-000000000001', null,         'Así nace una pegatina Memento ✦ Pronto podrás escanearla y tu foto viajará directa a su chincheta del mapa.', 5),
  ('5b000000-0000-4000-8000-000000000003', '5a1e0000-0000-4000-8000-000000000002', 'praga',      'Hora azul en el Puente de Carlos y tormenta sobre Týn el mismo día. Praga hace lo que quiere. Desliza →', 8),
  ('5b000000-0000-4000-8000-000000000004', '5a1e0000-0000-4000-8000-000000000003', 'venecia',    'Rialto desde el agua y postales para todos los que no vinieron. ¿A quién le escribo la primera?', 14),
  ('5b000000-0000-4000-8000-000000000005', '5a1e0000-0000-4000-8000-000000000004', 'budapest',   'El Parlamento encendido a medianoche. Ninguna foto le hace justicia (esta lo intenta).', 20),
  ('5b000000-0000-4000-8000-000000000006', '5a1e0000-0000-4000-8000-000000000005', 'bled',       'Bled entre ramas. La isla parece puesta a mano.', 26),
  ('5b000000-0000-4000-8000-000000000007', '5a1e0000-0000-4000-8000-000000000002', 'viena',      'Viena al atardecer: la cúpula de Peterskirche asomando al final de la calle.', 30),
  ('5b000000-0000-4000-8000-000000000008', '5a1e0000-0000-4000-8000-000000000004', 'bratislava', 'Bratislava en dos colores: el celeste de la Iglesia Azul y el verde de la Puerta de San Miguel.', 36),
  ('5b000000-0000-4000-8000-000000000009', '5a1e0000-0000-4000-8000-000000000001', null,         'Un recuerdo que vuelve a moverse. Los vídeos viven aquí y en el mapa; los scrapbooks se quedan con las fotos.', 44),
  ('5b000000-0000-4000-8000-000000000010', '5a1e0000-0000-4000-8000-000000000005', 'londres',    'Big Ben de noche, sin andamios y sin prisa.', 50),
  ('5b000000-0000-4000-8000-000000000011', '5a1e0000-0000-4000-8000-000000000006', 'alsacia',    'Alsacia en Navidad: luces en el canal y olor a vino caliente.', 60),
  ('5b000000-0000-4000-8000-000000000012', '5a1e0000-0000-4000-8000-000000000003', null,         'Una calle entera mirando hacia arriba. ☂️', 72),
  ('5b000000-0000-4000-8000-000000000013', '5a1e0000-0000-4000-8000-000000000002', null,         'Noria, bolas gigantes y chocolate. Temporada oficialmente abierta.', 80),
  ('5b000000-0000-4000-8000-000000000014', '5a1e0000-0000-4000-8000-000000000005', 'alpes',      'Un río que copia las nubes.', 96),
  ('5b000000-0000-4000-8000-000000000015', '5a1e0000-0000-4000-8000-000000000006', 'lisboa',     'Tranvías amarillos y cuestas imposibles. Lisboa se sube andando.', 110),
  ('5b000000-0000-4000-8000-000000000016', '5a1e0000-0000-4000-8000-000000000004', 'kioto',      'Kioto en primavera: bajar el ritmo era esto.', 130),
  ('5b000000-0000-4000-8000-000000000017', '5a1e0000-0000-4000-8000-000000000001', null,         'Nuestra pared de inspiración. ¿Qué pegarías tú en la tuya?', 150)
) as v(id, author, place, caption, hours)
on conflict (id) do nothing;

insert into public.social_post_media (post_id, kind, url, width, height, duration_seconds, position)
select v.post::uuid, v.kind, v.url, v.w, v.h, v.dur, v.pos
from (values
  ('5b000000-0000-4000-8000-000000000001', 'photo', '/paisajes/web/panama-playa-1080.webp',               1080, 1920, null::numeric, 0),
  ('5b000000-0000-4000-8000-000000000002', 'video', '/memento_sticker.mp4',                               1280,  618, 8.0, 0),
  ('5b000000-0000-4000-8000-000000000003', 'photo', '/paisajes/web/praga-puente-carlos-1080.webp',        1080, 1920, null, 0),
  ('5b000000-0000-4000-8000-000000000003', 'photo', '/paisajes/web/praga-tyn-1080.webp',                  1080, 1920, null, 1),
  ('5b000000-0000-4000-8000-000000000004', 'photo', '/paisajes/web/venecia-rialto-1080.webp',             1080, 1920, null, 0),
  ('5b000000-0000-4000-8000-000000000004', 'photo', '/paisajes/web/venecia-postales-1280.webp',           1280,  960, null, 1),
  ('5b000000-0000-4000-8000-000000000005', 'photo', '/paisajes/web/budapest-parlamento-1280.webp',        1280,  720, null, 0),
  ('5b000000-0000-4000-8000-000000000006', 'photo', '/paisajes/web/bled-lago-1080.webp',                  1080, 1920, null, 0),
  ('5b000000-0000-4000-8000-000000000007', 'photo', '/paisajes/web/viena-peterskirche-1080.webp',         1080, 1920, null, 0),
  ('5b000000-0000-4000-8000-000000000008', 'photo', '/paisajes/web/bratislava-iglesia-azul-1080.webp',    1080, 1920, null, 0),
  ('5b000000-0000-4000-8000-000000000008', 'photo', '/paisajes/web/bratislava-puerta-1080.webp',          1080, 1920, null, 1),
  ('5b000000-0000-4000-8000-000000000009', 'video', '/gemini_generated_video_c518b2ac%20-%20Trim.mp4',    1280,  720, 12.6, 0),
  ('5b000000-0000-4000-8000-000000000010', 'photo', '/paisajes/web/londres-big-ben-576.webp',              576, 1024, null, 0),
  ('5b000000-0000-4000-8000-000000000011', 'photo', '/paisajes/web/alsacia-canal-1080.webp',              1080, 1440, null, 0),
  ('5b000000-0000-4000-8000-000000000012', 'photo', '/paisajes/web/calle-paraguas-1080.webp',             1080, 1920, null, 0),
  ('5b000000-0000-4000-8000-000000000013', 'photo', '/paisajes/web/mercado-navidad-1080.webp',            1080, 1440, null, 0),
  ('5b000000-0000-4000-8000-000000000014', 'photo', '/paisajes/web/alpes-rio-1080.webp',                  1080, 1920, null, 0),
  ('5b000000-0000-4000-8000-000000000015', 'photo', 'https://images.unsplash.com/photo-1555881400-74d7acaacd8b?auto=format&fit=crop&w=1200&q=85', 1200, 800, null, 0),
  ('5b000000-0000-4000-8000-000000000016', 'photo', 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=1200&q=85', 1200, 800, null, 0),
  ('5b000000-0000-4000-8000-000000000017', 'photo', '/paisajes/web/collage-pared-1080.webp',              1080,  960, null, 0)
) as v(post, kind, url, w, h, dur, pos)
where not exists (select 1 from public.social_post_media m where m.post_id = v.post::uuid and m.position = v.pos);

-- ── Interacciones entre las cuentas de muestra ──────────────────────────────
insert into public.social_likes (post_id, user_id, created_at)
select p.id, u.id, p.created_at + interval '25 minutes'
from public.social_posts p cross join public.profiles u
where p.id::text like '5b000000-%' and u.id::text like '5a1e0000-%' and u.id <> p.author_id
  and abs(hashtext(p.id::text || u.id::text)) % 5 <> 0
on conflict do nothing;

insert into public.social_comments (id, post_id, author_id, body, created_at)
select v.id::uuid, v.post::uuid, v.author::uuid, v.body, now() - make_interval(hours => v.hours)
from (values
  ('5c000000-0000-4000-8000-000000000001', '5b000000-0000-4000-8000-000000000001', '5a1e0000-0000-4000-8000-000000000003', '¿Esto es real? Me voy mañana.', 2),
  ('5c000000-0000-4000-8000-000000000002', '5b000000-0000-4000-8000-000000000001', '5a1e0000-0000-4000-8000-000000000002', 'La lancha roja es la protagonista 😍', 1),
  ('5c000000-0000-4000-8000-000000000003', '5b000000-0000-4000-8000-000000000003', '5a1e0000-0000-4000-8000-000000000004', 'La segunda parece un cuadro.', 7),
  ('5c000000-0000-4000-8000-000000000004', '5b000000-0000-4000-8000-000000000003', '5a1e0000-0000-4000-8000-000000000005', 'Praga en hora azul es otro planeta.', 6),
  ('5c000000-0000-4000-8000-000000000005', '5b000000-0000-4000-8000-000000000004', '5a1e0000-0000-4000-8000-000000000006', '¡Yo quiero una postal! 🙋‍♀️', 12),
  ('5c000000-0000-4000-8000-000000000006', '5b000000-0000-4000-8000-000000000005', '5a1e0000-0000-4000-8000-000000000002', 'Pues lo ha conseguido.', 18),
  ('5c000000-0000-4000-8000-000000000007', '5b000000-0000-4000-8000-000000000006', '5a1e0000-0000-4000-8000-000000000003', 'Apuntado para el verano.', 25),
  ('5c000000-0000-4000-8000-000000000008', '5b000000-0000-4000-8000-000000000002', '5a1e0000-0000-4000-8000-000000000004', '¿Dónde se consiguen? Las quiero todas.', 4),
  ('5c000000-0000-4000-8000-000000000009', '5b000000-0000-4000-8000-000000000011', '5a1e0000-0000-4000-8000-000000000005', 'Esto huele a canela desde aquí.', 58),
  ('5c000000-0000-4000-8000-000000000010', '5b000000-0000-4000-8000-000000000008', '5a1e0000-0000-4000-8000-000000000006', 'No sabía que Bratislava tenía tanto color.', 34)
) as v(id, post, author, body, hours)
on conflict (id) do nothing;

insert into public.social_follows (follower_id, followee_id)
select a.id, b.id from public.profiles a cross join public.profiles b
where a.id::text like '5a1e0000-%' and b.id::text like '5a1e0000-%' and a.id <> b.id
  and abs(hashtext(a.id::text || b.id::text)) % 3 <> 0
on conflict do nothing;

insert into public.social_place_follows (user_id, place_id)
select u.id, pl.id from public.profiles u cross join public.social_places pl
where u.id::text like '5a1e0000-%' and abs(hashtext(u.id::text || pl.slug)) % 3 = 0
on conflict do nothing;
