// Package mailtest is a fake SMTP server for tests: plain connection, no
// authentication, every mail it accepts handed back to the test.
package mailtest

import (
	"bufio"
	"net"
	"strconv"
	"strings"
	"testing"
	"time"
)

// Received is one mail as the server got it.
type Received struct {
	From string
	To   []string
	// Data is the raw message: headers, blank line, body.
	Data string
}

// Server listens on a local port until the test ends.
type Server struct {
	Host string
	Port int

	reject map[string]bool
	mails  chan Received
}

// NewServer starts a fake SMTP server; RCPT TO is refused for every address
// in rejectRecipients.
func NewServer(t *testing.T, rejectRecipients ...string) *Server {
	t.Helper()
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("listen: %v", err)
	}
	t.Cleanup(func() { _ = ln.Close() })

	addr := ln.Addr().(*net.TCPAddr)
	s := &Server{
		Host:   addr.IP.String(),
		Port:   addr.Port,
		reject: map[string]bool{},
		mails:  make(chan Received, 4),
	}
	for _, r := range rejectRecipients {
		s.reject[r] = true
	}
	go func() {
		for {
			conn, err := ln.Accept()
			if err != nil {
				return
			}
			go s.serve(conn)
		}
	}()
	return s
}

// Addr is "host:port".
func (s *Server) Addr() string {
	return net.JoinHostPort(s.Host, strconv.Itoa(s.Port))
}

// Next waits for the next mail the server accepted.
func (s *Server) Next(t *testing.T) Received {
	t.Helper()
	select {
	case m := <-s.mails:
		return m
	case <-time.After(5 * time.Second):
		t.Fatal("no mail received")
		return Received{}
	}
}

func (s *Server) serve(conn net.Conn) {
	defer func() { _ = conn.Close() }()
	r := bufio.NewReader(conn)
	reply := func(line string) { _, _ = conn.Write([]byte(line + "\r\n")) }

	reply("220 fake ESMTP")
	var mail Received
	for {
		line, err := r.ReadString('\n')
		if err != nil {
			return
		}
		cmd := strings.TrimRight(line, "\r\n")
		upper := strings.ToUpper(cmd)
		switch {
		case strings.HasPrefix(upper, "EHLO"), strings.HasPrefix(upper, "HELO"):
			reply("250-fake")
			reply("250 8BITMIME")
		case strings.HasPrefix(upper, "MAIL FROM:"):
			mail = Received{From: address(cmd)}
			reply("250 OK")
		case strings.HasPrefix(upper, "RCPT TO:"):
			to := address(cmd)
			if s.reject[to] {
				reply("550 no such user")
				continue
			}
			mail.To = append(mail.To, to)
			reply("250 OK")
		case upper == "DATA":
			reply("354 go ahead")
			var data strings.Builder
			for {
				l, err := r.ReadString('\n')
				if err != nil {
					return
				}
				if l == ".\r\n" {
					break
				}
				data.WriteString(l)
			}
			mail.Data = data.String()
			s.mails <- mail
			reply("250 queued")
		case upper == "QUIT":
			reply("221 bye")
			return
		default:
			reply("250 OK")
		}
	}
}

// address pulls the address out of "MAIL FROM:<a@b>" / "RCPT TO:<a@b>".
func address(cmd string) string {
	start, end := strings.Index(cmd, "<"), strings.LastIndex(cmd, ">")
	if start < 0 || end <= start {
		return ""
	}
	return cmd[start+1 : end]
}
