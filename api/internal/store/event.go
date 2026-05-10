package store

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
)

type Event struct {
	EventID   int64     `json:"eventId"`
	SeasonID  int64     `json:"seasonId"`
	EventDate time.Time `json:"eventDate"`
	Finalized bool      `json:"finalized"`
}

func (s *Store) CreateEvent(ctx context.Context, seasonID int64, eventDate time.Time) (*Event, error) {
	const q = `
		INSERT INTO event (season_id, event_date)
		VALUES ($1, $2)
		RETURNING event_id, season_id, event_date, finalized
	`
	out := &Event{}
	err := s.DB.QueryRow(ctx, q, seasonID, eventDate).Scan(&out.EventID, &out.SeasonID, &out.EventDate, &out.Finalized)
	if err != nil {
		return nil, err
	}
	return out, nil
}

func (s *Store) ListEvents(ctx context.Context, seasonID int64) ([]Event, error) {
	const q = `
		SELECT event_id, season_id, event_date, finalized
		FROM event
		WHERE season_id=$1
		ORDER BY event_date
	`
	rows, err := s.DB.Query(ctx, q, seasonID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Event
	for rows.Next() {
		var e Event
		if err := rows.Scan(&e.EventID, &e.SeasonID, &e.EventDate, &e.Finalized); err != nil {
			return nil, err
		}
		out = append(out, e)
	}
	return out, rows.Err()
}

func (s *Store) GetEvent(ctx context.Context, eventID int64) (*Event, error) {
	const q = `
		SELECT event_id, season_id, event_date, finalized
		FROM event WHERE event_id=$1
	`
	e := &Event{}
	err := s.DB.QueryRow(ctx, q, eventID).Scan(&e.EventID, &e.SeasonID, &e.EventDate, &e.Finalized)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return e, nil
}

func (s *Store) SetEventFinalized(ctx context.Context, eventID int64, finalized bool, byPlayerID int64, reopenReason *string) error {
	if finalized {
		const q = `
			UPDATE event
			SET finalized=true, finalized_at=now(), finalized_by=$2,
			    reopened_at=NULL, reopened_by=NULL, reopen_reason=NULL, updated_at=now()
			WHERE event_id=$1 AND finalized=false
		`
		tag, err := s.DB.Exec(ctx, q, eventID, byPlayerID)
		if err != nil {
			return err
		}
		if tag.RowsAffected() == 0 {
			return ErrNotFound
		}
		return nil
	}
	if reopenReason == nil || *reopenReason == "" {
		return errors.New("reopen reason required")
	}
	const q = `
		UPDATE event
		SET finalized=false, reopened_at=now(), reopened_by=$2, reopen_reason=$3, updated_at=now()
		WHERE event_id=$1 AND finalized=true
	`
	tag, err := s.DB.Exec(ctx, q, eventID, byPlayerID, *reopenReason)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}
