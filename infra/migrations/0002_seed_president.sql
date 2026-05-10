-- Dev/default league president (password: changeme — change in production).
INSERT INTO player (username, full_name, gender, password_hash, role, email_opt_in)
VALUES (
  'president',
  'League President',
  'Male',
  '$2a$10$AteIoQVTzO1MLvUWWvPDReNwzJ9iy9hdd5tbClC2x4M0G3vUB7X1O',
  'President',
  TRUE
)
ON CONFLICT (username) DO NOTHING;
