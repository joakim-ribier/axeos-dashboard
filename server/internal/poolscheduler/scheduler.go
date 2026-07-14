// cmd/dashboard-api/poolscheduler/scheduler.go
package poolscheduler

import (
	"log/slog"
	"time"

	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/axeos"
	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/config"
	"github.com/robfig/cron/v3"
)

type Scheduler struct {
	logger *slog.Logger
	config config.Config

	cron *cron.Cron
}

func NewPoolScheduler(logger *slog.Logger, config config.Config) *Scheduler {
	s := &Scheduler{
		logger: logger.With("namespace", "PoolScheduler"),
		config: config,

		cron: cron.New(cron.WithSeconds(), cron.WithLocation(time.Local)),
	}

	s.init()

	return s
}

func (s *Scheduler) init() {
	s.logger.Info("Pool scheduler configure...")
	axeOs := axeos.NewAxeOs(s.logger, s.config)

	for _, miner := range s.config.GetMiners() {
		for _, schedule := range miner.PoolSchedule {
			s.logger.Info("New job scheduled!", "ip", miner.Ip, "cron", schedule.Cron, "pool", schedule.Target)

			_, err := s.cron.AddFunc(schedule.Cron, func() {
				s.logger.Info("Switching to a new pool!", "ip", miner.Ip, "pool", schedule.Target)

				axeOs.SwitchPool(miner, schedule.Target)
			})

			if err != nil {
				s.logger.Error("Failed to add new scheduled job!", "ip", miner.Ip, "cron", schedule.Cron, "pool", schedule.Target, "error", err)
				continue
			}
		}
	}

	s.logger.Info("Pool scheduler completed.")
}

func (s *Scheduler) Start() {
	s.logger.Info("Pool scheduler running...")
	s.cron.Start()
}

func (s *Scheduler) Stop() {
	s.logger.Info("Pool scheduler stopped!")
	s.cron.Stop()
}
