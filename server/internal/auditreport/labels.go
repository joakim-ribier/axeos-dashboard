package auditreport

import (
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/audit"
)

// labels is one language's wording of the report. types/fields/sources/
// services are the dashboard's own audit labels (ui/src/locales,
// auditPage.*), copied here since the mail is built server-side -- a test
// keeps both in step.
type labels struct {
	types, fields, sources, services map[string]string
	// values words a stored value by field (on/off, a frequency...), as
	// auditPage.values does.
	values map[string]map[string]string

	failed, changed, query, nothing string
	// utc and open close the text version: the time zone, and the link.
	utc, open string
	// colon is ": " -- " : " in French typography.
	colon            string
	weekdays, months []string
	count            func(int) string
	// title names the period, for the template's {{title}}.
	title func(Period) string
	// dayTime is an entry's day and time, for a period of several days;
	// day a day (.PeriodStart...), sentAt the send's date and time.
	dayTime, day, sentAt string
}

func labelsFor(lang string) labels {
	if lang == "fr" {
		return fr
	}
	return en
}

// label is m[key], or key itself for one this version doesn't know.
func (l labels) label(m map[string]string, key string) string {
	if v, ok := m[key]; ok {
		return v
	}
	return key
}

// Entry is one entry as the report shows it: its time, who or what did it
// (the dashboard from which address, or which service), on which miner (by
// name), how it failed if it did, and what it changed, one item each.
type Entry struct {
	Time, Who, Miner, Failure string
	Details                   []string
}

// entry words e -- its day too for a period of several days; miners named
// after names (IP -> display name).
func (l labels) entry(e audit.Entry, withDay bool, names map[string]string) Entry {
	who := l.label(l.sources, string(e.Source))
	switch {
	case e.Service != "":
		who += " · " + l.label(l.services, e.Service)
	case e.IP != "":
		who += " (" + e.IP + ")"
	}
	layout := "15:04"
	if withDay {
		layout = l.dayTime
	}
	out := Entry{Time: e.Timestamp.UTC().Format(layout), Who: who}
	if e.Target != "" {
		out.Miner = miner(e.Target, names)
	}
	if e.Status >= 400 || e.Error != "" {
		out.Failure = l.failed
		if e.Status >= 400 {
			out.Failure += " (" + strconv.Itoa(e.Status) + ")"
		}
		if e.Error != "" {
			out.Failure += l.colon + e.Error
		}
	}

	// A report's own entry reads as one line -- its period and recipients
	// aren't changes to the config, just what it covered and who got it.
	if e.Type == audit.TypeAuditReport {
		var parts []string
		var to []string
		for _, c := range e.Changes {
			if c.Field == "sentTo" {
				to = append(to, c.After)
				continue
			}
			parts = append(parts, l.label(l.fields, c.Field)+l.colon+l.value(c.Field, c.After))
		}
		if len(to) > 0 {
			parts = append(parts, l.label(l.fields, "sentTo")+l.colon+strings.Join(to, ", "))
		}
		if len(parts) > 0 {
			out.Details = []string{strings.Join(parts, " · ")}
		}
		return out
	}

	for _, c := range e.Changes {
		field := l.label(l.fields, c.Field)
		switch {
		case c.Kind == audit.ChangeAdded:
			out.Details = append(out.Details, "+ "+field+l.colon+c.After)
		case c.Kind == audit.ChangeRemoved:
			out.Details = append(out.Details, "− "+field+l.colon+c.Before)
		case c.Before == "" && c.After == "":
			out.Details = append(out.Details, field+l.colon+l.changed)
		default:
			out.Details = append(out.Details, field+l.colon+l.value(c.Field, c.Before)+" → "+l.value(c.Field, c.After))
		}
	}
	if len(e.Changes) == 0 && e.Query != "" {
		out.Details = append(out.Details, l.query+l.colon+e.Query)
	}
	return out
}

// text is the entry as the text version shows it: one line, then its
// details indented.
func (e Entry) text() string {
	var b strings.Builder
	fmt.Fprintf(&b, "  %s  %s", e.Time, e.Who)
	if e.Miner != "" {
		b.WriteString(" · " + e.Miner)
	}
	if e.Failure != "" {
		b.WriteString(" · " + e.Failure)
	}
	b.WriteString("\n")
	for _, d := range e.Details {
		fmt.Fprintf(&b, "         %s\n", d)
	}
	return b.String()
}

// miner is "name (ip)" for a configured miner, the bare IP otherwise.
func miner(ip string, names map[string]string) string {
	if name := names[ip]; name != "" {
		return name + " (" + ip + ")"
	}
	return ip
}

// value is v as the dashboard words it for field -- "—" when empty.
func (l labels) value(field, v string) string {
	if v == "" {
		return "—"
	}
	if w, ok := l.values[field][v]; ok {
		return w
	}
	return v
}

var fr = labels{
	values: map[string]map[string]string{
		"auditReportEnabled":     {"on": "activé", "off": "désactivé"},
		"alertsMail":             {"on": "activé", "off": "désactivé"},
		"sendUser":               {"on": "activé", "off": "désactivé"},
		"sendPools":              {"on": "activé", "off": "désactivé"},
		"sendIP":                 {"on": "activé", "off": "désactivé"},
		"auditReportSkipIfEmpty": {"on": "activé", "off": "désactivé"},
		"auditReportFrequency":   {"daily": "Tous les jours", "every2days": "Tous les 2 jours", "weekly": "Chaque semaine", "monthly": "Chaque mois"},
		"smtpSecurity":           {"starttls": "STARTTLS", "tls": "TLS", "none": "Aucune"},
		"mailLanguage":           {"fr": "Français", "en": "English"},
	},
	types: map[string]string{
		"restart":          "Redémarrage",
		"switch_primary":   "Bascule vers le pool principal",
		"switch_fallback":  "Bascule vers le pool de secours",
		"save_miners":      "Enregistrement des mineurs",
		"save_settings":    "Enregistrement des paramètres",
		"export_audit":     "Export de l'audit",
		"download_backups": "Téléchargement de sauvegardes",
		"discover":         "Détection réseau",
		"backup":           "Sauvegarde mise à jour",
		"audit_report":     "Rapport d'audit envoyé",
		"alert_mail":       "Mail d'alertes non envoyé",
		"miner_pool":       "Pool du mineur modifié",
		"miner_schedule":   "Planification modifiée",
		"miner_identity":   "IP du mineur modifiée",
		"miner_disabled":   "Mineur désactivé",
		"miner_enabled":    "Mineur activé",
		"miner_added":      "Mineur ajouté",
		"remote_push":      "Accès distant modifié",
		"mail_settings":    "Notifications modifiées",
	},
	fields: map[string]string{
		"url":                    "URL principale",
		"port":                   "Port principal",
		"user":                   "Utilisateur principal",
		"fallbackUrl":            "URL de secours",
		"fallbackPort":           "Port de secours",
		"fallbackUser":           "Utilisateur de secours",
		"ip":                     "IP",
		"pushURL":                "URL de push",
		"apiKey":                 "Clé API",
		"sendUser":               "Envoi de l'utilisateur / wallet",
		"sendPools":              "Envoi des pools",
		"sendIP":                 "Envoi de l'IP",
		"scheduleAdded":          "Tâche ajoutée",
		"scheduleRemoved":        "Tâche supprimée",
		"alias":                  "Alias",
		"hostname":               "Nom d'hôte",
		"model":                  "Modèle",
		"ratePerKwh":             "Tarif (€/kWh)",
		"deviceAdded":            "Appareil ajouté",
		"deviceRemoved":          "Appareil supprimé",
		"poolDashboardAdded":     "Dashboard de pool ajouté",
		"poolDashboardRemoved":   "Dashboard de pool supprimé",
		"firmwareRepoAdded":      "Dépôt firmware ajouté",
		"firmwareRepoRemoved":    "Dépôt firmware supprimé",
		"backupMonth":            "Mois sauvegardé",
		"smtpHost":               "Serveur SMTP",
		"smtpPort":               "Port SMTP",
		"smtpSecurity":           "Sécurité SMTP",
		"smtpUsername":           "Identifiant SMTP",
		"smtpFrom":               "Expéditeur",
		"smtpPassword":           "Mot de passe SMTP",
		"recipientAdded":         "Destinataire ajouté",
		"recipientRemoved":       "Destinataire retiré",
		"reportPeriod":           "Période du rapport",
		"sentTo":                 "Envoyé à",
		"mailLanguage":           "Langue des mails",
		"mailDashboardURL":       "Adresse du dashboard",
		"auditReportEnabled":     "Rapport d'audit",
		"alertsMail":             "Alertes par mail",
		"alertPoll":              "Relevé des alertes",
		"auditReportFrequency":   "Fréquence du rapport d'audit",
		"auditReportSkipIfEmpty": "Rapport sauté si vide",
		"auditReportTypeAdded":   "Type ajouté au rapport",
		"auditReportTypeRemoved": "Type retiré du rapport",
	},
	sources:  map[string]string{"api": "Dashboard", "system": "Système"},
	services: map[string]string{"scheduler": "Planificateur", "backup": "Sauvegarde de chaque nuit", "mailer": "Notifications"},

	failed:   "Échec",
	changed:  "valeur modifiée",
	query:    "Paramètres",
	nothing:  "Aucun événement ce jour-là.",
	utc:      "Jours et heures en UTC.",
	open:     "Voir dans le dashboard",
	colon:    " : ",
	weekdays: []string{"dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"},
	months: []string{"janvier", "février", "mars", "avril", "mai", "juin", "juillet",
		"août", "septembre", "octobre", "novembre", "décembre"},
	count: func(n int) string {
		switch n {
		case 0:
			return "aucun événement"
		case 1:
			return "1 événement"
		}
		return strconv.Itoa(n) + " événements"
	},
}

var en = labels{
	values: map[string]map[string]string{
		"auditReportEnabled":     {"on": "on", "off": "off"},
		"alertsMail":             {"on": "on", "off": "off"},
		"sendUser":               {"on": "on", "off": "off"},
		"sendPools":              {"on": "on", "off": "off"},
		"sendIP":                 {"on": "on", "off": "off"},
		"auditReportSkipIfEmpty": {"on": "on", "off": "off"},
		"auditReportFrequency":   {"daily": "Every day", "every2days": "Every 2 days", "weekly": "Every week", "monthly": "Every month"},
		"smtpSecurity":           {"starttls": "STARTTLS", "tls": "TLS", "none": "None"},
		"mailLanguage":           {"fr": "Français", "en": "English"},
	},
	types: map[string]string{
		"restart":          "Restart",
		"switch_primary":   "Switch to primary pool",
		"switch_fallback":  "Switch to fallback pool",
		"save_miners":      "Miners saved",
		"save_settings":    "Settings saved",
		"export_audit":     "Audit export",
		"download_backups": "Backups download",
		"discover":         "Network discovery",
		"backup":           "Backup updated",
		"audit_report":     "Audit report sent",
		"alert_mail":       "Alerts mail not sent",
		"miner_pool":       "Miner pool changed",
		"miner_schedule":   "Schedule changed",
		"miner_identity":   "Miner IP changed",
		"miner_disabled":   "Miner disabled",
		"miner_enabled":    "Miner enabled",
		"miner_added":      "Miner added",
		"remote_push":      "Remote push changed",
		"mail_settings":    "Notifications changed",
	},
	fields: map[string]string{
		"url":                    "Primary URL",
		"port":                   "Primary port",
		"user":                   "Primary user",
		"fallbackUrl":            "Fallback URL",
		"fallbackPort":           "Fallback port",
		"fallbackUser":           "Fallback user",
		"ip":                     "IP",
		"pushURL":                "Push URL",
		"apiKey":                 "API key",
		"sendUser":               "User / wallet push",
		"sendPools":              "Pools push",
		"sendIP":                 "IP push",
		"scheduleAdded":          "Job added",
		"scheduleRemoved":        "Job removed",
		"alias":                  "Alias",
		"hostname":               "Hostname",
		"model":                  "Model",
		"ratePerKwh":             "Rate (€/kWh)",
		"deviceAdded":            "Device added",
		"deviceRemoved":          "Device removed",
		"poolDashboardAdded":     "Pool dashboard added",
		"poolDashboardRemoved":   "Pool dashboard removed",
		"firmwareRepoAdded":      "Firmware repo added",
		"firmwareRepoRemoved":    "Firmware repo removed",
		"backupMonth":            "Month backed up",
		"smtpHost":               "SMTP server",
		"smtpPort":               "SMTP port",
		"smtpSecurity":           "SMTP security",
		"smtpUsername":           "SMTP username",
		"smtpFrom":               "Sender",
		"smtpPassword":           "SMTP password",
		"recipientAdded":         "Recipient added",
		"recipientRemoved":       "Recipient removed",
		"reportPeriod":           "Report period",
		"sentTo":                 "Sent to",
		"mailLanguage":           "Mail language",
		"mailDashboardURL":       "Dashboard address",
		"auditReportEnabled":     "Audit report",
		"alertsMail":             "Alerts by mail",
		"alertPoll":              "Alerts' poll",
		"auditReportFrequency":   "Audit report frequency",
		"auditReportSkipIfEmpty": "Report skipped when empty",
		"auditReportTypeAdded":   "Type added to the report",
		"auditReportTypeRemoved": "Type removed from the report",
	},
	sources:  map[string]string{"api": "Dashboard", "system": "System"},
	services: map[string]string{"scheduler": "Scheduler", "backup": "Nightly backup", "mailer": "Notifications"},

	failed:   "Failed",
	changed:  "value changed",
	query:    "Parameters",
	nothing:  "Nothing recorded that day.",
	utc:      "Days and times in UTC.",
	open:     "Open in the dashboard",
	colon:    ": ",
	weekdays: []string{"Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"},
	months: []string{"January", "February", "March", "April", "May", "June", "July",
		"August", "September", "October", "November", "December"},
	count: func(n int) string {
		switch n {
		case 0:
			return "no event"
		case 1:
			return "1 event"
		}
		return strconv.Itoa(n) + " events"
	},
}

// last is the period's last day -- To is excluded.
func (p Period) last() time.Time {
	return p.To.AddDate(0, 0, -1)
}

func init() {
	fr.dayTime = "02/01 15:04"
	fr.title = func(p Period) string {
		if p.OneDay() {
			d := p.From
			return fmt.Sprintf("Audit du %s %d %s %d", fr.weekdays[d.Weekday()], d.Day(), fr.months[d.Month()-1], d.Year())
		}
		return fmt.Sprintf("Audit du %s au %s", p.From.Format("02/01/2006"), p.last().Format("02/01/2006"))
	}
	fr.day = "02/01/2006"
	fr.sentAt = "02/01/2006 à 15:04"

	en.dayTime = "Jan 2 15:04"
	en.title = func(p Period) string {
		if p.OneDay() {
			d := p.From
			return fmt.Sprintf("Audit for %s, %s %d, %d", en.weekdays[d.Weekday()], en.months[d.Month()-1], d.Day(), d.Year())
		}
		return fmt.Sprintf("Audit from %s to %s", p.From.Format(dateLayout), p.last().Format(dateLayout))
	}
	en.day = dateLayout
	en.sentAt = "2006-01-02 15:04"
}
