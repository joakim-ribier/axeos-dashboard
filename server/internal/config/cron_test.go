package config

import "testing"

func TestValidateCronSchedule(t *testing.T) {
	tests := []struct {
		name    string
		expr    string
		wantErr bool
	}{
		{name: "valid, seconds field included", expr: "59 59 23 * * FRI"},
		{name: "valid, every second", expr: "* * * * * *"},
		{name: "missing seconds field (5 fields)", expr: "59 23 * * FRI", wantErr: true},
		{name: "empty", expr: "", wantErr: true},
		{name: "garbage", expr: "not a cron expression", wantErr: true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateCronSchedule(tt.expr)
			if (err != nil) != tt.wantErr {
				t.Errorf("ValidateCronSchedule(%q) error = %v, wantErr %v", tt.expr, err, tt.wantErr)
			}
		})
	}
}

func TestNormalizeCronExpression(t *testing.T) {
	tests := []struct {
		name string
		a, b string
		want bool // whether a and b should normalize to the same value
	}{
		{name: "identical", a: "59 59 23 * * FRI", b: "59 59 23 * * FRI", want: true},
		{name: "differing case", a: "59 59 23 * * FRI", b: "59 59 23 * * fri", want: true},
		{name: "differing whitespace", a: "59  59 23 * * FRI", b: "59 59 23 * * FRI", want: true},
		{name: "leading/trailing whitespace", a: " 59 59 23 * * FRI ", b: "59 59 23 * * FRI", want: true},
		{name: "actually different", a: "59 59 23 * * FRI", b: "59 59 23 * * SUN", want: false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := NormalizeCronExpression(tt.a) == NormalizeCronExpression(tt.b)
			if got != tt.want {
				t.Errorf("NormalizeCronExpression(%q) == NormalizeCronExpression(%q) = %v, want %v", tt.a, tt.b, got, tt.want)
			}
		})
	}
}
