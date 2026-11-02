// cmd/miner-api/healthcheck/response.go
package healtcheck

type AxeOsModel interface {
	ToAxeOs() AxeOs
}

type AxeOs struct {
	Hostname string `json:"hostname"`
	MacAddr  string `json:"macAddr"`

	Temp float64 `json:"temp"`
	Ping float64 `json:"ping"`

	URL           string `json:"URL"`
	FallbackURL   string `json:"fallbackURL"`
	UsingFallback bool   `json:"usingFallback"`

	SharesAccepted int64 `json:"sharesAccepted"`
}

type MinerCommon struct {
	Hostname string `json:"hostname"`
	MacAddr  string `json:"macAddr"`

	Temp float64 `json:"temp"`

	StratumURL         string `json:"stratumURL"`
	FallbackStratumURL string `json:"fallbackStratumURL"`
	SharesAccepted     int64  `json:"sharesAccepted"`
}

type Nerdaxe struct {
	MinerCommon

	Ping    float64 `json:"lastpingrtt"`
	Stratum struct {
		UsingFallback bool `json:"usingFallback"`
	} `json:"stratum"`
}

type Bitaxe struct {
	MinerCommon

	ResponseTime           float64 `json:"responseTime"`
	IsUsingFallbackStratum int64   `json:"isUsingFallbackStratum"`
}

func (m MinerCommon) toAxeOsBase() AxeOs {
	return AxeOs{
		Hostname:       m.Hostname,
		MacAddr:        m.MacAddr,
		Temp:           m.Temp,
		URL:            m.StratumURL,
		FallbackURL:    m.FallbackStratumURL,
		SharesAccepted: m.SharesAccepted,
	}
}

func (n Nerdaxe) ToAxeOs() AxeOs {
	ax := n.toAxeOsBase()
	ax.Ping = n.Ping
	ax.UsingFallback = n.Stratum.UsingFallback
	return ax
}

func (b Bitaxe) ToAxeOs() AxeOs {
	ax := b.toAxeOsBase()
	ax.Ping = b.ResponseTime
	ax.UsingFallback = b.IsUsingFallbackStratum == 1
	return ax
}
