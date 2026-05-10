package store

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Store struct {
	DB *pgxpool.Pool
}

func New(db *pgxpool.Pool) *Store {
	return &Store{DB: db}
}

type Player struct {
	PlayerID      int64  `json:"playerId"`
	Username      string `json:"username"`
	FullName      string `json:"fullName"`
	Gender        string `json:"gender"`
	IsActive      bool   `json:"isActive"`
	Role          string `json:"role"`
	PasswordHash  string `json:"-"`
	Email         *string `json:"email,omitempty"`
	EmailOptIn    bool   `json:"emailOptIn"`
}

var ErrNotFound = errors.New("not found")

func (s *Store) ListPlayers(ctx context.Context) ([]Player, error) {
	const q = `
		SELECT player_id, username, full_name, gender::text, is_active, role, email, email_opt_in
		FROM player
		ORDER BY full_name, username
	`
	rows, err := s.DB.Query(ctx, q)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []Player
	for rows.Next() {
		var p Player
		if err := rows.Scan(&p.PlayerID, &p.Username, &p.FullName, &p.Gender, &p.IsActive, &p.Role, &p.Email, &p.EmailOptIn); err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

type CreatePlayerParams struct {
	Username     string
	FullName     string
	Gender       string
	PasswordHash string
	Email        *string
	EmailOptIn   bool
	Role         string
}

func (s *Store) CreatePlayer(ctx context.Context, p CreatePlayerParams) (*Player, error) {
	const q = `
		INSERT INTO player (username, full_name, gender, password_hash, email, email_opt_in, role)
		VALUES ($1,$2,$3,$4,$5,$6,$7)
		RETURNING player_id, username, full_name, gender::text, is_active, role, password_hash, email, email_opt_in
	`
	out := &Player{}
	err := s.DB.QueryRow(ctx, q, p.Username, p.FullName, p.Gender, p.PasswordHash, p.Email, p.EmailOptIn, p.Role).Scan(
		&out.PlayerID,
		&out.Username,
		&out.FullName,
		&out.Gender,
		&out.IsActive,
		&out.Role,
		&out.PasswordHash,
		&out.Email,
		&out.EmailOptIn,
	)
	if err != nil {
		return nil, err
	}
	return out, nil
}

type UpdatePlayerParams struct {
	PlayerID   int64
	FullName   string
	Gender     string
	IsActive   bool
	Email      *string
	EmailOptIn bool
	Role       string
}

func (s *Store) UpdatePlayer(ctx context.Context, p UpdatePlayerParams) (*Player, error) {
	const q = `
		UPDATE player
		SET full_name=$2, gender=$3, is_active=$4, email=$5, email_opt_in=$6, role=$7, updated_at=now()
		WHERE player_id=$1
		RETURNING player_id, username, full_name, gender::text, is_active, role, password_hash, email, email_opt_in
	`
	out := &Player{}
	err := s.DB.QueryRow(ctx, q, p.PlayerID, p.FullName, p.Gender, p.IsActive, p.Email, p.EmailOptIn, p.Role).Scan(
		&out.PlayerID,
		&out.Username,
		&out.FullName,
		&out.Gender,
		&out.IsActive,
		&out.Role,
		&out.PasswordHash,
		&out.Email,
		&out.EmailOptIn,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return out, nil
}

type UpdateSelfEmailParams struct {
	PlayerID   int64
	Email      *string
	EmailOptIn bool
}

func (s *Store) UpdateSelfEmail(ctx context.Context, p UpdateSelfEmailParams) (*Player, error) {
	const q = `
		UPDATE player
		SET email=$2, email_opt_in=$3, email_opt_in_updated_at=now(), updated_at=now()
		WHERE player_id=$1
		RETURNING player_id, username, full_name, gender::text, is_active, role, password_hash, email, email_opt_in
	`
	out := &Player{}
	err := s.DB.QueryRow(ctx, q, p.PlayerID, p.Email, p.EmailOptIn).Scan(
		&out.PlayerID,
		&out.Username,
		&out.FullName,
		&out.Gender,
		&out.IsActive,
		&out.Role,
		&out.PasswordHash,
		&out.Email,
		&out.EmailOptIn,
	)
	if err != nil {
		return nil, err
	}
	return out, nil
}

func (s *Store) GetPlayerByUsername(ctx context.Context, username string) (*Player, error) {
	const q = `
		SELECT player_id, username, full_name, gender::text, is_active, role, password_hash, email, email_opt_in
		FROM player
		WHERE username=$1
	`
	p := &Player{}
	err := s.DB.QueryRow(ctx, q, username).Scan(
		&p.PlayerID,
		&p.Username,
		&p.FullName,
		&p.Gender,
		&p.IsActive,
		&p.Role,
		&p.PasswordHash,
		&p.Email,
		&p.EmailOptIn,
	)
	if err != nil {
		return nil, err
	}
	return p, nil
}

func (s *Store) GetPlayerByID(ctx context.Context, id int64) (*Player, error) {
	const q = `
		SELECT player_id, username, full_name, gender::text, is_active, role, password_hash, email, email_opt_in
		FROM player
		WHERE player_id=$1
	`
	p := &Player{}
	err := s.DB.QueryRow(ctx, q, id).Scan(
		&p.PlayerID,
		&p.Username,
		&p.FullName,
		&p.Gender,
		&p.IsActive,
		&p.Role,
		&p.PasswordHash,
		&p.Email,
		&p.EmailOptIn,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return p, nil
}

func (s *Store) UpdatePlayerPassword(ctx context.Context, playerID int64, passwordHash string) error {
	const q = `UPDATE player SET password_hash=$2, updated_at=now() WHERE player_id=$1`
	tag, err := s.DB.Exec(ctx, q, playerID, passwordHash)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

