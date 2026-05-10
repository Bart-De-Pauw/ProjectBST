package auth

import "testing"

func TestPasswordHashAndVerify(t *testing.T) {
	hash, err := HashPassword("correct horse battery staple")
	if err != nil {
		t.Fatalf("hash: %v", err)
	}

	if err := VerifyPassword("correct horse battery staple", hash); err != nil {
		t.Fatalf("verify ok: %v", err)
	}
	if err := VerifyPassword("wrong", hash); err == nil {
		t.Fatalf("expected verify failure")
	}
}

