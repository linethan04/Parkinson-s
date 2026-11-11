# Slide-ready figures for Aims 1 and 2
# Open Parkinson-s.Rproj first so paths start at the project root.
# Figures have no titles: the slide title carries the message.
# Saved to output/slides_aims_1_2/ (PNG, 200 dpi). Runs in about 20 s.
library(tidyverse)
library(lmerTest)
library(patchwork)
library(ggrepel)

out_dir <- "output/slides_aims_1_2"
dir.create(out_dir, recursive = TRUE, showWarnings = FALSE)

# ---- Look ----
bg        <- "#F7F5F0"   # same as the slide background
ink       <- "#1C2430"
ink_soft  <- "#4F5866"
ink_muted <- "#8A909A"
grid_col  <- "#E6E2D9"
axis_col  <- "#C9C4B8"
blue      <- "#2A78D6"
orange    <- "#E5622D"
red       <- "#D6453D"
grey      <- "#B3AFA6"
teal      <- "#1F8A7E"
amber     <- "#D99A1E"

col_part        <- c("Between people" = blue, "Within a person" = orange)
col_progression <- c(Worsened = red, Stable = grey, Improved = blue)
col_sex         <- c(Male = teal, Female = amber)
font            <- "Avenir Next"

theme_slide <- function() {
  theme_minimal(base_size = 17, base_family = font) +
    theme(
      text             = element_text(colour = ink_soft),
      axis.title       = element_text(colour = ink_soft, size = rel(0.9)),
      axis.title.x     = element_text(margin = margin(t = 10)),
      axis.title.y     = element_text(margin = margin(r = 10)),
      axis.text        = element_text(colour = ink_soft, size = rel(0.85)),
      axis.line.x      = element_line(colour = axis_col, linewidth = 0.5),
      panel.grid.major = element_line(colour = grid_col, linewidth = 0.4),
      panel.grid.minor = element_blank(),
      panel.spacing    = unit(2, "lines"),
      strip.text       = element_text(face = "bold", colour = ink, hjust = 0, size = rel(1),
                                      margin = margin(b = 8)),
      plot.subtitle    = element_text(colour = ink, face = "bold", size = rel(0.95),
                                      margin = margin(b = 10)),
      legend.position  = "top",
      legend.justification = "left",
      legend.text      = element_text(colour = ink_soft, size = rel(0.9)),
      legend.title     = element_blank(),
      plot.background  = element_rect(fill = bg, colour = NA),
      panel.background = element_rect(fill = bg, colour = NA),
      plot.margin      = margin(14, 20, 10, 14)
    )
}
theme_set(theme_slide())

save_slide <- function(plot, name, width = 12, height = 5.6) {
  ggsave(file.path(out_dir, paste0(name, ".png")), plot, width = width, height = height,
         dpi = 200, device = ragg::agg_png, bg = bg)
}

# ---- 1. Load and clean (same steps as pd_figures.R) ----
pad <- read_csv("data/parkinsons+telemonitoring/parkinsons_updrs.data", show_col_types = FALSE) |>
  transmute(
    subject = factor(`subject#`), age,
    sex = if_else(sex == 0, "Male", "Female"),
    test_time, months = test_time / 30.4, session = floor(test_time),
    motor_updrs = motor_UPDRS, total_updrs = total_UPDRS,
    jitter_pct = `Jitter(%)`, jitter_abs = `Jitter(Abs)`, jitter_rap = `Jitter:RAP`,
    jitter_ppq5 = `Jitter:PPQ5`, shimmer = Shimmer, shimmer_db = `Shimmer(dB)`,
    shimmer_apq3 = `Shimmer:APQ3`, shimmer_apq5 = `Shimmer:APQ5`,
    shimmer_apq11 = `Shimmer:APQ11`, nhr = NHR, hnr = HNR
  )

# Voice scores: log the skewed measures, z-score, average, z-score again
z <- function(x) as.numeric(scale(x))
pad <- pad |>
  mutate(
    jitter_score  = z(z(log(jitter_pct)) + z(log(jitter_abs)) + z(log(jitter_rap)) + z(log(jitter_ppq5))),
    shimmer_score = z(z(log(shimmer)) + z(log(shimmer_db)) + z(log(shimmer_apq3)) +
                      z(log(shimmer_apq5)) + z(log(shimmer_apq11))),
    noise_score   = z(z(log(nhr)) - z(hnr))
  ) |>
  group_by(subject) |>
  mutate(
    jitter_person  = mean(jitter_score),  jitter_diff  = jitter_score - jitter_person,
    shimmer_person = mean(shimmer_score), shimmer_diff = shimmer_score - shimmer_person,
    noise_person   = mean(noise_score),   noise_diff   = noise_score - noise_person
  ) |>
  ungroup()

# One row per home session (~6 recordings that share one UPDRS value)
sessions <- pad |>
  group_by(subject, age, sex, session) |>
  summarise(months = mean(months), motor_updrs = mean(motor_updrs),
            total_updrs = mean(total_updrs), jitter_score = mean(jitter_score),
            shimmer_score = mean(shimmer_score), noise_score = mean(noise_score),
            .groups = "drop")

# One row per person (n = 42)
people <- pad |>
  arrange(subject, test_time) |>
  group_by(subject, age, sex) |>
  summarise(mean_motor = mean(motor_updrs), mean_total = mean(total_updrs),
            motor_change = last(motor_updrs) - first(motor_updrs),
            jitter = mean(jitter_score), shimmer = mean(shimmer_score),
            noise = mean(noise_score), .groups = "drop") |>
  mutate(progression = case_when(motor_change >= 2.5  ~ "Worsened",
                                 motor_change <= -2.5 ~ "Improved",
                                 TRUE                 ~ "Stable"),
         progression = factor(progression, levels = c("Worsened", "Stable", "Improved")))

count(people, progression)
count(people, sex)

# ---- 2. Numbers used on the slides ----
# ICC: share of UPDRS variation that is between people
icc <- function(y) {
  vc <- as.data.frame(VarCorr(lmer(reformulate("(1 | subject)", y), data = pad)))$vcov
  vc[1] / sum(vc)
}
icc_motor <- icc("motor_updrs")
icc_total <- icc("total_updrs")
c(icc_motor, icc_total)

# Aim 1: one mixed model per outcome and voice score
aim1 <- tibble()
for (y in c("motor_updrs", "total_updrs")) {
  for (s in c("jitter", "shimmer", "noise")) {
    f   <- as.formula(paste0(y, " ~ ", s, "_person + ", s, "_diff + months + (1 | subject)"))
    tab <- coef(summary(lmer(f, data = pad)))
    for (part in c("person", "diff")) {
      term <- paste0(s, "_", part)
      aim1 <- bind_rows(aim1, tibble(outcome = y, score = s, part = part,
                                     estimate = tab[term, "Estimate"], se = tab[term, "Std. Error"],
                                     df = tab[term, "df"], p = tab[term, "Pr(>|t|)"]))
    }
  }
}
aim1 <- aim1 |>
  mutate(p_adj   = p.adjust(p, method = "BH"),
         lower   = estimate - qt(0.975, df) * se,
         upper   = estimate + qt(0.975, df) * se,
         outcome = if_else(outcome == "motor_updrs", "Motor UPDRS", "Total UPDRS"),
         score   = factor(str_to_title(score), levels = c("Noise", "Shimmer", "Jitter")),
         part    = if_else(part == "person", "Between people", "Within a person"))
print(aim1, n = 12)

# Within-person correlations (session level), one per person
within_rho <- sessions |>
  group_by(subject) |>
  summarise(Jitter  = cor(jitter_score, motor_updrs, method = "spearman"),
            Shimmer = cor(shimmer_score, motor_updrs, method = "spearman"),
            Noise   = cor(noise_score, motor_updrs, method = "spearman")) |>
  pivot_longer(-subject, names_to = "score", values_to = "rho")
within_rho |> group_by(score) |> summarise(median = median(rho))

# Between-person correlations (n = 42)
people |> summarise(across(c(jitter, shimmer, noise), ~ cor(.x, mean_motor, method = "spearman")))

# Aim 2: one row per person
aim2_motor <- lm(mean_motor ~ age + sex, data = people)
aim2_total <- lm(mean_total ~ age + sex, data = people)
summary(aim2_motor)
summary(aim2_total)
people |> group_by(sex) |> summarise(n = n(), motor = mean(mean_motor), total = mean(mean_total))
t.test(mean_motor ~ sex, data = people)
people |> group_by(progression) |> summarise(n = n(), median_age = median(age))
kruskal.test(age ~ progression, data = people)

# Does age explain the between-person voice effect? (links Aim 1 and Aim 2)
adj <- tibble()
for (s in c("jitter", "shimmer", "noise")) {
  fit1 <- coef(summary(lm(reformulate(s, "mean_motor"), data = people)))[s, ]
  fit2 <- coef(summary(lm(reformulate(c(s, "age", "sex"), "mean_motor"), data = people)))[s, ]
  adj <- bind_rows(adj, tibble(score = s, crude = fit1[1], crude_p = fit1[4],
                               adjusted = fit2[1], adjusted_p = fit2[4]))
}
adj
people |> summarise(across(c(jitter, shimmer, noise), ~ cor(.x, age)))


# =====================================================================
# FIGURES
# =====================================================================

# ---- A. Study design: who was recorded when ----
figA_data <- sessions |> mutate(subject = fct_reorder(subject, motor_updrs, .fun = mean))

figA <- ggplot(figA_data, aes(months, subject, colour = motor_updrs)) +
  annotate("rect", xmin = c(-0.12, 2.88, 5.88), xmax = c(0.12, 3.12, 6.12),
           ymin = -Inf, ymax = Inf, fill = "#ECE8DF") +
  geom_point(size = 1.9) +
  annotate("text", x = c(0, 3, 6), y = 44.2, label = c("Clinic visit", "Clinic visit", "Clinic visit"),
           family = font, size = 4.6, colour = ink_soft) +
  scale_colour_gradient(low = "#CFE0F7", high = "#0B2F5E", name = "Motor UPDRS") +
  scale_x_continuous(breaks = 0:7, labels = c("0", "1", "2", "3", "4", "5", "6", "7 months")) +
  scale_y_discrete(expand = expansion(add = c(0.8, 3.6))) +
  coord_cartesian(clip = "off") +
  guides(colour = guide_colourbar(barwidth = unit(12, "lines"), barheight = unit(0.6, "lines"),
                                  title.vjust = 0.85)) +
  labs(x = NULL, y = "42 people, sorted by severity") +
  theme(axis.text.y = element_blank(), panel.grid.major.y = element_blank(),
        legend.title = element_text(colour = ink_soft, size = rel(0.85)))

save_slide(figA, "A_study_design", width = 12, height = 6.2)


# ---- B. Explainer: a person's usual voice vs today's wobble ----
# Two people with clearly different usual voices
pick <- people |> arrange(shimmer) |> slice(c(8, n() - 6)) |> pull(subject)
figB_data <- sessions |>
  filter(subject %in% pick) |>
  group_by(subject) |>
  mutate(usual = mean(shimmer_score)) |>
  ungroup() |>
  mutate(who = if_else(subject == pick[2], "Person A", "Person B"))
figB_lab <- figB_data |> group_by(who) |> summarise(usual = first(usual), x = max(months))

figB <- ggplot(figB_data, aes(months, shimmer_score, colour = who)) +
  geom_segment(aes(xend = months, y = usual, yend = shimmer_score), linewidth = 0.6, alpha = 0.45) +
  geom_hline(data = figB_lab, aes(yintercept = usual, colour = who), linewidth = 1.3) +
  geom_point(size = 2.8) +
  geom_text(data = figB_lab, aes(x = x + 0.15, y = usual, label = paste0(who, "’s\nusual voice")),
            hjust = 0, family = font, size = 5, lineheight = 0.9, fontface = "bold") +
  scale_colour_manual(values = c("Person A" = blue, "Person B" = "#7FA9DE"), guide = "none") +
  scale_x_continuous(breaks = 0:6, expand = expansion(mult = c(0.02, 0.16))) +
  labs(x = "Months", y = "Shimmer score (higher = worse)")

save_slide(figB, "B_usual_vs_wobble", width = 12, height = 5.6)


# ---- C. Aim 1 forest plot ----
figC <- ggplot(aim1, aes(estimate, score, colour = part)) +
  geom_vline(xintercept = 0, colour = ink_muted, linewidth = 0.6) +
  geom_linerange(aes(xmin = lower, xmax = upper), linewidth = 1.6, alpha = 0.9,
                 position = position_dodge(width = 0.6)) +
  geom_point(aes(fill = part), shape = 21, colour = bg, size = 5.2, stroke = 1.2,
             position = position_dodge(width = 0.6)) +
  geom_text(aes(x = upper, label = sprintf("%+.1f", estimate)),
            position = position_dodge(width = 0.6), hjust = -0.3, size = 5, family = font,
            show.legend = FALSE) +
  facet_wrap(~outcome) +
  scale_colour_manual(values = col_part) +
  scale_fill_manual(values = col_part) +
  scale_x_continuous(expand = expansion(mult = c(0.05, 0.18))) +
  labs(x = "UPDRS points per 1 SD worse voice (95% CI)", y = NULL) +
  theme(panel.grid.major.y = element_blank(), axis.text.y = element_text(size = rel(1.05), colour = ink))

save_slide(figC, "C_aim1_forest", width = 12, height = 5.6)


# ---- D. Between vs within in the raw data ----
figD_left <- ggplot(people, aes(shimmer, mean_motor)) +
  geom_smooth(method = "lm", formula = y ~ x, colour = blue, fill = "#DCE7F5", linewidth = 1) +
  geom_point(shape = 21, fill = blue, colour = bg, size = 3.6, stroke = 0.8) +
  labs(subtitle = "Between people (1 dot = 1 person)",
       x = "Person’s usual shimmer score", y = "Average motor UPDRS")

figD_right_data <- within_rho |> mutate(score = factor(score, levels = c("Noise", "Shimmer", "Jitter")))
figD_med <- figD_right_data |> group_by(score) |> summarise(rho = median(rho))

figD_right <- ggplot(figD_right_data, aes(rho, score)) +
  geom_vline(xintercept = 0, colour = ink_muted, linewidth = 0.6) +
  geom_point(position = position_jitter(height = 0.2, seed = 1),
             shape = 21, fill = orange, colour = bg, size = 3.2, stroke = 0.6, alpha = 0.9) +
  geom_point(data = figD_med, shape = "|", size = 13, colour = ink) +
  scale_x_continuous(limits = c(-1, 1), breaks = c(-1, -0.5, 0, 0.5, 1)) +
  labs(subtitle = "Within a person (1 dot = 1 person)",
       x = "Correlation of voice with UPDRS over time", y = NULL) +
  theme(panel.grid.major.y = element_blank(), axis.text.y = element_text(colour = ink))

figD <- figD_left + figD_right + plot_layout(widths = c(1, 1.15))
save_slide(figD, "D_between_vs_within", width = 12.5, height = 5.6)


# ---- E. One person up close ----
example_id <- people |> filter(progression == "Worsened") |> arrange(motor_change) |>
  slice(ceiling(n() / 2)) |> pull(subject)
one_rec  <- filter(pad, subject == example_id)
one_sess <- filter(sessions, subject == example_id)

figE_top <- ggplot(one_rec, aes(months, shimmer_score)) +
  geom_point(colour = grey, size = 1.6, alpha = 0.7) +
  geom_line(data = one_sess, colour = blue, linewidth = 1) +
  geom_point(data = one_sess, colour = blue, size = 2.4) +
  scale_x_continuous(limits = c(-0.5, 7.3), breaks = 0:7) +
  labs(subtitle = "Voice (shimmer score), every recording", x = NULL, y = NULL) +
  theme(axis.text.x = element_blank())

# The clinic visits: first session, last session, and where the straight line bends
slope  <- diff(one_sess$motor_updrs) / diff(one_sess$months)
bend   <- which.max(abs(diff(slope))) + 1
visits <- one_sess |> slice(c(1, bend, n()))
figE_bottom <- ggplot(one_sess, aes(months, motor_updrs)) +
  geom_line(colour = red, linewidth = 1.4) +
  geom_point(data = visits, shape = 21, fill = red, colour = bg, size = 5, stroke = 1.2) +
  scale_x_continuous(limits = c(-0.5, 7.3), breaks = 0:7,
                     labels = c("0", "1", "2", "3", "4", "5", "6", "7 months")) +
  labs(subtitle = "Motor UPDRS: scored at clinic visits (dots), straight lines filled in between",
       x = NULL, y = NULL)

figE <- figE_top / figE_bottom + plot_layout(heights = c(1.3, 1))
save_slide(figE, "E_one_person", width = 12, height = 6)


# ---- F. Aim 2: age vs UPDRS, coloured by sex ----
figF_data <- people |>
  pivot_longer(c(mean_motor, mean_total), names_to = "outcome", values_to = "updrs") |>
  mutate(outcome = if_else(outcome == "mean_motor", "Motor UPDRS", "Total UPDRS"))

figF <- ggplot(figF_data, aes(age, updrs)) +
  geom_smooth(method = "lm", formula = y ~ x, colour = ink_soft, fill = "#E6E2D9", linewidth = 1) +
  geom_point(aes(fill = sex), shape = 21, colour = bg, size = 4, stroke = 0.8) +
  facet_wrap(~outcome, scales = "free_y") +
  scale_fill_manual(values = col_sex) +
  labs(x = "Age (years)", y = "Average UPDRS")

save_slide(figF, "F_aim2_age", width = 12, height = 5.6)


# ---- G. Aim 2: men vs women ----
figG_data <- figF_data |> mutate(sex = factor(sex, levels = c("Male", "Female")))
figG_mean <- figG_data |> group_by(outcome, sex) |> summarise(updrs = mean(updrs), n = n(), .groups = "drop")

figG <- ggplot(figG_data, aes(sex, updrs, colour = sex)) +
  geom_point(position = position_jitter(width = 0.13, seed = 2), size = 3.4, alpha = 0.75) +
  geom_errorbar(data = figG_mean, aes(ymin = updrs, ymax = updrs), width = 0.42,
                linewidth = 1.4, colour = ink) +
  geom_text(data = figG_mean, aes(x = as.numeric(sex) + 0.3, label = sprintf("%.1f", updrs)),
            hjust = 0, colour = ink, family = font, size = 5.2, fontface = "bold") +
  facet_wrap(~outcome, scales = "free_y") +
  scale_colour_manual(values = col_sex, guide = "none") +
  scale_x_discrete(labels = c(Male = "Men (28)", Female = "Women (14)")) +
  labs(x = NULL, y = "Average UPDRS") +
  theme(panel.grid.major.x = element_blank(), axis.text.x = element_text(colour = ink, size = rel(1)))

save_slide(figG, "G_aim2_sex", width = 12, height = 5.6)


# ---- H. Progression: change in motor UPDRS per person ----
figH_data <- people |> mutate(subject = fct_reorder(subject, motor_change))
group_n   <- count(people, progression)

figH <- ggplot(figH_data, aes(subject, motor_change, colour = progression)) +
  annotate("rect", xmin = -Inf, xmax = Inf, ymin = -2.5, ymax = 2.5, fill = "#ECE8DF") +
  annotate("text", x = levels(figH_data$subject)[1], y = 2.1, label = "±2.5 points: no meaningful change",
           hjust = 0, vjust = 1, family = font, size = 4.6, colour = ink_soft) +
  geom_hline(yintercept = 0, colour = axis_col) +
  geom_segment(aes(xend = subject, y = 0, yend = motor_change), linewidth = 1.1) +
  geom_point(size = 3.6) +
  scale_colour_manual(values = col_progression,
                      labels = paste0(group_n$progression, " (", group_n$n, ")")) +
  labs(x = "42 people, sorted by change", y = "Change in motor UPDRS\n(last − first recording)") +
  theme(axis.text.x = element_blank(), panel.grid.major.x = element_blank())

save_slide(figH, "H_progression", width = 12, height = 5.6)


# ---- I. Age by progression group ----
figI_med <- people |> group_by(progression) |> summarise(age = median(age))

figI <- ggplot(people, aes(age, progression, colour = progression)) +
  geom_point(position = position_jitter(height = 0.14, seed = 1), size = 4, alpha = 0.85) +
  geom_point(data = figI_med, shape = "|", size = 16, colour = ink) +
  geom_text(data = figI_med, aes(label = paste("median", age)), nudge_y = 0.38,
            colour = ink, family = font, size = 5, fontface = "bold") +
  scale_colour_manual(values = col_progression, guide = "none") +
  scale_y_discrete(limits = rev) +
  labs(x = "Age (years)", y = NULL) +
  theme(panel.grid.major.y = element_blank(), axis.text.y = element_text(colour = ink, size = rel(1.05)))

save_slide(figI, "I_age_by_progression", width = 12, height = 5.2)


# ---- J. Linking Aims 1 and 2: between-person voice effect before and after age and sex ----
figJ_data <- adj |>
  mutate(score = factor(str_to_title(score), levels = c("Noise", "Shimmer", "Jitter"))) |>
  pivot_longer(c(crude, adjusted), names_to = "model", values_to = "estimate") |>
  mutate(model = factor(if_else(model == "crude", "Voice alone", "Voice + age + sex"),
                        levels = c("Voice alone", "Voice + age + sex")))

figJ <- ggplot(figJ_data, aes(estimate, score)) +
  geom_vline(xintercept = 0, colour = ink_muted, linewidth = 0.6) +
  geom_line(aes(group = score), colour = axis_col, linewidth = 2.2) +
  geom_point(aes(fill = model), shape = 21, colour = bg, size = 7, stroke = 1.2) +
  geom_text(aes(label = sprintf("%+.1f", estimate), colour = model), vjust = -1.4,
            family = font, size = 5.2, fontface = "bold", show.legend = FALSE) +
  scale_fill_manual(values = c("Voice alone" = blue, "Voice + age + sex" = "#9DBDE6")) +
  scale_colour_manual(values = c("Voice alone" = blue, "Voice + age + sex" = "#6F93C2")) +
  scale_x_continuous(limits = c(0, 3.2), breaks = 0:3) +
  labs(x = "Motor UPDRS points per 1 SD worse usual voice (n = 42)", y = NULL) +
  theme(panel.grid.major.y = element_blank(), axis.text.y = element_text(colour = ink, size = rel(1.05)))

save_slide(figJ, "J_voice_and_age", width = 12, height = 5.2)
