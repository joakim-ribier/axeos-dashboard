package handler

import (
	"encoding/json"
	"net/http"
)

// ErrorResponse represents a JSON error response.
type ErrorResponse struct {
	Error   string `json:"error"`
	Message string `json:"message,omitempty"`
	Code    int    `json:"code,omitempty"`

	// HashboardURL is set only on the "board is private" 403 (see
	// RequireBoardAccess) — the request that would normally carry it (a
	// successful MinersResponse) never gets a chance to run, so the
	// frontend needs it here to build its "request access" link/form.
	HashboardURL string `json:"hashboardURL,omitempty"`
}

// writeErrorResponse sends a JSON error response with the given status code.
func writeErrorResponse(w http.ResponseWriter, message string, statusCode int) {
	writeErrorResponseWithHashboardURL(w, message, statusCode, "")
}

// writeErrorResponseWithHashboardURL is writeErrorResponse plus an optional
// hashboardURL — see ErrorResponse.HashboardURL.
func writeErrorResponseWithHashboardURL(w http.ResponseWriter, message string, statusCode int, hashboardURL string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)

	resp := ErrorResponse{
		Error:        http.StatusText(statusCode),
		Message:      message,
		Code:         statusCode,
		HashboardURL: hashboardURL,
	}

	_ = json.NewEncoder(w).Encode(resp)
}
