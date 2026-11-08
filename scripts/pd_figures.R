# Parkinson's voice project: cleaning, extra wrangling and figures
# Open Parkinson-s.Rproj first so paths start at the project root.
# Figures are saved to output/figures/ as PNG (300 dpi) and PDF.
library(tidyverse)
library(lmerTest)   # mixed models with p-values
library(patchwork)  # put plots side by side
library(ggrepel)    # labels that don't overlap
library(ranger)     # random forest
source("scripts/theme_pd.R")

dir.create("output/figures", recursive = TRUE, showWarnings = FALSE)
set.seed(2026)

# ---- 1. Load ----
pad_raw <- read_csv("data/parkinsons+telemonitoring/parkinsons_updrs.data", show_col_types = FALSE)
puc_raw <- read_csv("data/parkinsons.data", show_col_types = FALSE)

# ---- 2. Clean (same names as PD.PROJECT.Rmd) ----
pad <- pad_raw |>
  transmute(
    subject       = factor(`subject#`),
    age,
    sex           = if_else(sex == 0, "Male", "Female"),
    test_time,
    months        = test_time / 30.4,
    session       = floor(test_time),   # recordings made on the same day
    motor_updrs   = motor_UPDRS,
    total_updrs   = total_UPDRS,
    jitter_pct    = `Jitter(%)`,
    jitter_abs    = `Jitter(Abs)`,
    jitter_rap    = `Jitter:RAP`,
    jitter_ppq5   = `Jitter:PPQ5`,
    shimmer       = Shimmer,
    shimmer_db    = `Shimmer(dB)`,
    shimmer_apq3  = `Shimmer:APQ3`,
    shimmer_apq5  = `Shimmer:APQ5`,
    shimmer_apq11 = `Shimmer:APQ11`,
    nhr           = NHR,
    hnr           = HNR
  )

puc <- puc_raw |>
  transmute(
    subject       = str_extract(name, "S\\d{2}"),
    group         = factor(if_else(status == 1, "PD", "Healthy"), levels = c("Healthy", "PD")),
    jitter_pct    = `MDVP:Jitter(%)`,
    jitter_abs    = `MDVP:Jitter(Abs)`,
    jitter_rap    = `MDVP:RAP`,
    jitter_ppq5   = `MDVP:PPQ`,
    shimmer       = `MDVP:Shimmer`,
    shimmer_db    = `MDVP:Shimmer(dB)`,
    shimmer_apq3  = `Shimmer:APQ3`,
    shimmer_apq5  = `Shimmer:APQ5`,
    shimmer_apq11 = `MDVP:APQ`,
    nhr           = NHR,
    hnr           = HNR
  )

voice_vars <- c("jitter_pct", "jitter_abs", "jitter_rap", "jitter_ppq5",
                "shimmer", "shimmer_db", "shimmer_apq3", "shimmer_apq5", "shimmer_apq11",
                "nhr", "hnr")
voice_labels <- c(jitter_pct = "Jitter (%)", jitter_abs = "Jitter (abs)",
                  jitter_rap = "Jitter RAP", jitter_ppq5 = "Jitter PPQ5",
                  shimmer = "Shimmer", shimmer_db = "Shimmer (dB)",
                  shimmer_apq3 = "Shimmer APQ3", shimmer_apq5 = "Shimmer APQ5",
                  shimmer_apq11 = "Shimmer APQ11", nhr = "NHR", hnr = "HNR")

# ---- 3. Voice scores ----
# Change from the Rmd: log the skewed measures BEFORE z-scoring.
# Raw jitter has skew ~6, so a few extreme recordings would dominate the score.
# HNR is already in dB (a log scale), so it is only flipped.
# Each score is z-scored again, so 1 unit = 1 SD of that score.
z <- function(x) as.numeric(scale(x))

add_voice_scores <- function(d) {
  d |>
    mutate(
      jitter_score  = z(z(log(jitter_pct)) + z(log(jitter_abs)) + z(log(jitter_rap)) + z(log(jitter_ppq5))),
      shimmer_score = z(z(log(shimmer)) + z(log(shimmer_db)) + z(log(shimmer_apq3)) +
                        z(log(shimmer_apq5)) + z(log(shimmer_apq11))),
      noise_score   = z(z(log(nhr)) - z(hnr))
    )
}

pad <- add_voice_scores(pad)
puc <- add_voice_scores(puc)

# Between-person (_person) and within-person (_diff) parts
pad <- pad |>
  group_by(subject) |>
  mutate(
    jitter_person  = mean(jitter_score),
    jitter_diff    = jitter_score - jitter_person,
    shimmer_person = mean(shimmer_score),
    shimmer_diff   = shimmer_score - shimmer_person,
    noise_person   = mean(noise_score),
    noise_diff     = noise_score - noise_person
  ) |>
  ungroup()

# ---- 4. New tables ----
# Sessions: each home session has ~6 recordings with the SAME UPDRS value,
# so averaging them gives 990 less noisy rows instead of 5,875.
sessions <- pad |>
  group_by(subject, age, sex, session) |>
  summarise(
    months        = mean(months),
    n_recordings  = n(),
    motor_updrs   = mean(motor_updrs),
    total_updrs   = mean(total_updrs),
    jitter_score  = mean(jitter_score),
    shimmer_score = mean(shimmer_score),
    noise_score   = mean(noise_score),
    .groups = "drop"
  )

# People: one row per person (n = 42)
people <- pad |>
  arrange(subject, test_time) |>
  group_by(subject, age, sex) |>
  summarise(
    n_recordings = n(),
    mean_motor   = mean(motor_updrs),
    mean_total   = mean(total_updrs),
    motor_change = last(motor_updrs) - first(motor_updrs),
    jitter       = mean(jitter_score),
    shimmer      = mean(shimmer_score),
    noise        = mean(noise_score),
    .groups = "drop"
  ) |>
  mutate(progression = case_when(
    motor_change >= 2.5  ~ "Worsened",
    motor_change <= -2.5 ~ "Improved",
    TRUE                 ~ "Stable"
  ),
  progression = factor(progression, levels = c("Worsened", "Stable", "Improved")))

pad      <- left_join(pad, select(people, subject, progression), by = "subject")
sessions <- left_join(sessions, select(people, subject, progression), by = "subject")

# Voice change: first 2 weeks vs last 2 weeks of each person's recordings
voice_change <- pad |>
  group_by(subject) |>
  mutate(window = case_when(
    test_time <= min(test_time) + 14 ~ "start",
    test_time >= max(test_time) - 14 ~ "end"
  )) |>
  filter(!is.na(window)) |>
  group_by(subject, window) |>
  summarise(Jitter = mean(jitter_score), Shimmer = mean(shimmer_score),
            Noise = mean(noise_score), .groups = "drop") |>
  pivot_longer(c(Jitter, Shimmer, Noise), names_to = "score", values_to = "value") |>
  pivot_wider(names_from = window, values_from = value) |>
  mutate(voice_change = end - start) |>
  left_join(select(people, subject, motor_change), by = "subject")

# Oxford data: one row per person (n = 32)
puc_people <- puc |>
  group_by(subject, group) |>
  summarise(n_recordings = n(),
            Jitter  = mean(jitter_score),
            Shimmer = mean(shimmer_score),
            Noise   = mean(noise_score),
            .groups = "drop")

# Quick checks
nrow(pad); nrow(sessions); nrow(people); nrow(puc_people)
count(people, progression)
count(puc_people, group)

# Share of UPDRS variation that is between people (ICC)
icc <- function(y) {
  vc <- as.data.frame(VarCorr(lmer(reformulate("(1 | subject)", y), data = pad)))$vcov
  vc[1] / sum(vc)
}
icc_motor <- icc("motor_updrs")
icc_total <- icc("total_updrs")
c(motor = icc_motor, total = icc_total)

score_levels <- c("Jitter", "Shimmer", "Noise")


# =====================================================================
# FIGURES
# =====================================================================

# ---- Fig 1. Study design: who was recorded when ----
fig1_data <- sessions |>
  mutate(subject = fct_reorder(subject, motor_updrs, .fun = mean))

fig1 <- ggplot(fig1_data, aes(months, subject, colour = motor_updrs)) +
  geom_vline(xintercept = c(0, 3, 6), colour = axis_col, linewidth = 0.6) +
  geom_point(size = 1.5) +
  annotate("text", x = c(0, 3, 6), y = 43.4, label = c("Baseline visit", "3-month visit", "6-month visit"),
           size = 2.9, colour = ink_soft) +
  scale_colour_gradient(low = "#cde2fb", high = "#0d366b", name = "Motor UPDRS") +
  scale_x_continuous(breaks = 0:7, expand = expansion(mult = c(0.03, 0.03))) +
  scale_y_discrete(expand = expansion(add = c(0.8, 2))) +
  guides(colour = guide_colourbar(barwidth = unit(10, "lines"), barheight = unit(0.5, "lines"),
                                  title.vjust = 0.9)) +
  labs(
    title = "42 people recorded their voice at home about once a week for six months",
    subtitle = paste0(
      "Each row is one person (sorted by severity) and each dot is one home session of ~6 recordings.\n",
      "UPDRS was only measured at the 3 clinic visits and filled in between. ",
      round(100 * icc_motor), "% of the variation in motor UPDRS\nis between people, which is why rows differ far more than dots within a row."),
    x = "Months since recruitment", y = "Person",
    caption = "Data: UCI Parkinson's Telemonitoring (Tsanas et al., 2010). 5,875 recordings in 990 sessions."
  ) +
  theme(axis.text.y = element_text(size = 6.5), panel.grid.major.y = element_blank())

save_fig(fig1, "fig01_study_design", width = 8, height = 8)


# ---- Fig 2. Why we log-transform before z-scoring ----
fig2_data <- pad |>
  select(jitter_pct, shimmer, nhr) |>
  pivot_longer(everything(), names_to = "measure", values_to = "raw") |>
  mutate(log = log(raw)) |>
  pivot_longer(c(raw, log), names_to = "scale", values_to = "value") |>
  mutate(panel = paste0(voice_labels[measure], if_else(scale == "raw", " — raw", " — log")),
         panel = factor(panel, levels = c("Jitter (%) — raw", "Shimmer — raw", "NHR — raw",
                                          "Jitter (%) — log", "Shimmer — log", "NHR — log")))

fig2 <- ggplot(fig2_data, aes(value, fill = scale)) +
  geom_histogram(bins = 50, colour = "white", linewidth = 0.15) +
  facet_wrap(~panel, scales = "free", ncol = 3) +
  scale_fill_manual(values = c(raw = grey, log = blue), guide = "none") +
  scale_y_continuous(expand = expansion(mult = c(0, 0.05))) +
  labs(
    title = "Voice measures are strongly skewed until they are logged",
    subtitle = "Top: raw values have a long right tail (skew ≈ 6 for jitter). Bottom: after a log, they are close to symmetric,\nso z-scores and averages are not dominated by a few unusual recordings.",
    x = NULL, y = "Recordings"
  )

save_fig(fig2, "fig02_log_transform", width = 9, height = 5.5)


# ---- Fig 3. The 11 voice measures are a few signals, not 11 ----
log_pad <- pad |>
  select(all_of(voice_vars)) |>
  mutate(across(-hnr, log))

cor_mat <- cor(log_pad)
fig3_data <- as.data.frame(as.table(cor_mat)) |>
  rename(row = Var1, col = Var2, r = Freq) |>
  mutate(row = factor(voice_labels[as.character(row)], levels = voice_labels),
         col = factor(voice_labels[as.character(col)], levels = voice_labels)) |>
  filter(as.integer(row) > as.integer(col))   # lower triangle only

fig3 <- ggplot(fig3_data, aes(col, fct_rev(row), fill = r)) +
  geom_tile(colour = "white", linewidth = 1) +
  geom_text(aes(label = sprintf("%.2f", r), colour = abs(r) > 0.6), size = 2.8) +
  scale_colour_manual(values = c(`TRUE` = "white", `FALSE` = ink_soft), guide = "none") +
  scale_fill_gradient2(low = blue, mid = "#f0efec", high = red, midpoint = 0,
                       limits = c(-1, 1), name = "Correlation") +
  guides(fill = guide_colourbar(barwidth = unit(10, "lines"), barheight = unit(0.5, "lines"),
                               title.position = "top")) +
  coord_fixed() +
  labs(
    title = "Jitter, shimmer and noise measures move together",
    subtitle = "Pearson correlations of the logged measures across 5,875 home recordings.\nEach family is so tightly linked that we average it into one score.",
    x = NULL, y = NULL
  ) +
  theme(axis.text.x = element_text(angle = 40, hjust = 1), panel.grid.major = element_blank(),
        axis.line.x = element_blank())

save_fig(fig3, "fig03_voice_correlations", width = 7.5, height = 7.5)


# ---- Fig 4. Do the two datasets measure voice on the same scale? ----
fig4_data <- bind_rows(
  pad |> mutate(dataset = "Home PD (telemonitoring)"),
  puc |> mutate(dataset = if_else(group == "PD", "Clinic PD (Oxford)", "Healthy (Oxford)"))
) |>
  select(dataset, all_of(voice_vars)) |>
  mutate(across(-c(dataset, hnr), log)) |>
  pivot_longer(-dataset, names_to = "measure", values_to = "value") |>
  mutate(measure = factor(voice_labels[measure], levels = voice_labels),
         dataset = factor(dataset, levels = names(col_dataset)))

fig4 <- ggplot(fig4_data, aes(value, colour = dataset, fill = dataset)) +
  geom_density(alpha = 0.12, linewidth = 0.7, adjust = 1.2) +
  facet_wrap(~measure, scales = "free", ncol = 4) +
  scale_colour_manual(values = col_dataset, name = NULL) +
  scale_fill_manual(values = col_dataset, name = NULL) +
  scale_y_continuous(expand = expansion(mult = c(0, 0.05))) +
  labs(
    title = "PD voices look alike at home and in the clinic, and differ from healthy voices",
    subtitle = "Distributions of each logged voice measure (HNR in dB). PD recordings from home and clinic line up closely,\nwhich supports matching the columns. Healthy people sit lower on jitter, shimmer and NHR, and higher on HNR.",
    x = "log(value)  ·  HNR in dB", y = "Density",
    caption = "Jitter PPQ5 = MDVP:PPQ and Shimmer APQ11 = MDVP:APQ in the Oxford file (still to confirm in Little et al., 2009)."
  ) +
  theme(axis.text.y = element_blank(), panel.grid.major.y = element_blank())

save_fig(fig4, "fig04_datasets_compared", width = 10, height = 7)


# ---- Fig 5. UPDRS over time, by progression group ----
group_n <- count(people, progression)
fig5_data <- pad |>
  left_join(group_n, by = "progression") |>
  mutate(facet = factor(paste0(progression, " (n = ", n, ")"),
                        levels = paste0(group_n$progression, " (n = ", group_n$n, ")")))

fig5 <- ggplot(fig5_data, aes(months, motor_updrs, group = subject, colour = progression)) +
  geom_line(linewidth = 0.6, alpha = 0.85) +
  facet_wrap(~facet) +
  scale_colour_manual(values = col_progression, guide = "none") +
  scale_x_continuous(breaks = c(0, 3, 6)) +
  labs(
    title = "About half of the people got meaningfully worse over six months",
    subtitle = "Each line is one person. Groups use a change of at least 2.5 points from first to last recording,\nthe minimal clinically important difference (Shulman et al., 2010). Lines bend at 3 months\nbecause UPDRS was only measured at the visits and joined with straight lines.",
    x = "Months since recruitment", y = "Motor UPDRS"
  )

save_fig(fig5, "fig05_updrs_trajectories", width = 9, height = 4.8)


# ---- Fig 6. One person up close: voice is noisy, UPDRS is a straight line ----
# Pick the person in the "Worsened" group with the median motor change
example_id <- people |>
  filter(progression == "Worsened") |>
  arrange(motor_change) |>
  slice(ceiling(n() / 2)) |>
  pull(subject)

one_rec  <- filter(pad, subject == example_id)
one_sess <- filter(sessions, subject == example_id)

fig6_top <- ggplot(one_rec, aes(months, shimmer_score)) +
  geom_hline(yintercept = 0, colour = axis_col) +
  geom_point(colour = grey, size = 1.3, alpha = 0.8) +
  geom_line(data = one_sess, colour = blue, linewidth = 0.7) +
  geom_point(data = one_sess, colour = blue, size = 2) +
  geom_vline(xintercept = c(0, 3, 6), colour = axis_col, linetype = "dotted") +
  scale_x_continuous(limits = c(-0.2, 7.2), breaks = 0:7) +
  labs(x = NULL, y = "Shimmer score\n(higher = worse)",
       subtitle = "Voice: grey = each recording, blue = session average") +
  theme(axis.text.x = element_blank(), plot.subtitle = element_text(margin = margin(b = 4)))

fig6_bottom <- ggplot(one_sess, aes(months, motor_updrs)) +
  geom_line(colour = red, linewidth = 1) +
  geom_vline(xintercept = c(0, 3, 6), colour = axis_col, linetype = "dotted") +
  scale_x_continuous(limits = c(-0.2, 7.2), breaks = 0:7) +
  labs(x = "Months since recruitment", y = "Motor UPDRS",
       subtitle = "Motor UPDRS: measured at clinic visits (dotted), straight lines in between") +
  theme(plot.subtitle = element_text(margin = margin(b = 4)))

fig6 <- fig6_top / fig6_bottom +
  plot_layout(heights = c(1.4, 1)) +
  plot_annotation(
    title = paste0("Person ", example_id, ": voice moves week to week, UPDRS can't follow it"),
    subtitle = "Because UPDRS between visits is interpolated, it cannot show short-term changes,\nso a within-person link between voice and UPDRS is hard to detect in this data."
  )

save_fig(fig6, "fig06_one_person", width = 8, height = 6)


# ---- Fig 7. How much did each person change? ----
fig7_data <- people |> mutate(subject = fct_reorder(subject, motor_change))

fig7 <- ggplot(fig7_data, aes(motor_change, subject, colour = progression)) +
  annotate("rect", xmin = -2.5, xmax = 2.5, ymin = -Inf, ymax = Inf, fill = "#f0efec") +
  annotate("text", x = 0, y = 43.2, label = "within ±2.5 points\n(no meaningful change)",
           size = 2.8, colour = ink_muted, lineheight = 0.95, vjust = 0) +
  geom_vline(xintercept = 0, colour = axis_col) +
  geom_segment(aes(x = 0, xend = motor_change, yend = subject), linewidth = 0.6) +
  geom_point(size = 2.4) +
  scale_colour_manual(values = col_progression, name = NULL) +
  scale_y_discrete(expand = expansion(add = c(0.8, 3.5))) +
  labs(
    title = "Change in motor UPDRS from first to last recording",
    subtitle = paste0(group_n$n[1], " worsened, ", group_n$n[2], " stayed stable and ",
                      group_n$n[3], " improved, using the 2.5-point clinically important difference."),
    x = "Change in motor UPDRS (points)", y = "Person"
  ) +
  theme(axis.text.y = element_text(size = 6.5), panel.grid.major.y = element_blank())

save_fig(fig7, "fig07_progression_change", width = 7, height = 8)


# ---- Fig 8. Aim 1: between-person vs within-person voice effects ----
# One mixed model per outcome and score, with both parts in the same model
aim1 <- tibble()
for (y in c("motor_updrs", "total_updrs")) {
  for (s in c("jitter", "shimmer", "noise")) {
    f   <- as.formula(paste0(y, " ~ ", s, "_person + ", s, "_diff + months + (1 | subject)"))
    fit <- lmer(f, data = pad)
    tab <- coef(summary(fit))
    for (part in c("person", "diff")) {
      term <- paste0(s, "_", part)
      aim1 <- bind_rows(aim1, tibble(outcome  = y, score = s, part = part,
                                     estimate = tab[term, "Estimate"],
                                     se       = tab[term, "Std. Error"],
                                     df       = tab[term, "df"],
                                     p        = tab[term, "Pr(>|t|)"]))
    }
  }
}

aim1 <- aim1 |>
  mutate(
    p_adj   = p.adjust(p, method = "BH"),
    lower   = estimate - qt(0.975, df) * se,
    upper   = estimate + qt(0.975, df) * se,
    outcome = if_else(outcome == "motor_updrs", "Motor UPDRS", "Total UPDRS"),
    score   = factor(str_to_title(score), levels = rev(score_levels)),
    part    = if_else(part == "person", "Between people", "Within a person")
  )
aim1

fig8 <- ggplot(aim1, aes(estimate, score, colour = part)) +
  geom_vline(xintercept = 0, colour = axis_col, linewidth = 0.6) +
  geom_linerange(aes(xmin = lower, xmax = upper), linewidth = 1,
                 position = position_dodge(width = 0.55)) +
  geom_point(aes(fill = part), shape = 21, colour = "white", size = 3.2, stroke = 0.8,
             position = position_dodge(width = 0.55)) +
  geom_text(aes(x = upper, label = sprintf("%+.2f", estimate)),
            position = position_dodge(width = 0.55), hjust = -0.25, size = 2.9,
            show.legend = FALSE) +
  facet_wrap(~outcome) +
  scale_colour_manual(values = col_part, name = NULL) +
  scale_fill_manual(values = col_part, name = NULL) +
  scale_x_continuous(expand = expansion(mult = c(0.05, 0.15))) +
  guides(colour = guide_legend(reverse = TRUE), fill = guide_legend(reverse = TRUE)) +
  labs(
    title = "Voice tells people apart more than it tracks change within a person",
    subtitle = "UPDRS points per 1 SD worse voice score, with 95% CIs. Mixed models with a random intercept per person\nand time in months. Between = the person's usual voice; within = one recording vs that person's usual.",
    x = "Change in UPDRS per 1 SD worse voice (points)", y = NULL,
    caption = paste0(sum(aim1$p_adj < 0.05), " of 12 effects are significant after Benjamini–Hochberg correction (smallest adjusted p = ",
                     sprintf("%.3f", min(aim1$p_adj)), "). Between-person effects rest on only 42 people.")
  ) +
  theme(panel.grid.major.y = element_blank())

save_fig(fig8, "fig08_aim1_effects", width = 9, height = 4.8)


# ---- Fig 9. Aim 1 in raw data: between people vs within a person ----
# A: each person's usual voice vs their average motor UPDRS
fig9a_data <- people |>
  pivot_longer(c(jitter, shimmer, noise), names_to = "score", values_to = "voice") |>
  mutate(score = factor(str_to_title(score), levels = score_levels))

fig9a_rho <- fig9a_data |>
  group_by(score) |>
  summarise(rho = cor(voice, mean_motor, method = "spearman"),
            x = min(voice), y = max(mean_motor))

fig9a <- ggplot(fig9a_data, aes(voice, mean_motor)) +
  geom_smooth(method = "lm", formula = y ~ x, colour = ink_soft, fill = "#e9e8e2", linewidth = 0.7) +
  geom_point(shape = 21, fill = blue, colour = "white", size = 2.6, stroke = 0.6) +
  geom_text_repel(data = filter(fig9a_data, abs(voice) > 1.5),
                  aes(label = paste("ID", subject)), size = 2.6, colour = ink_muted,
                  min.segment.length = 0, seed = 1) +
  geom_text(data = fig9a_rho, aes(-Inf, Inf, label = sprintf("Spearman ρ = %.2f", rho)),
            hjust = -0.05, vjust = 1.2, size = 3.1, colour = ink) +
  facet_wrap(~score, scales = "free_x") +
  scale_y_continuous(expand = expansion(mult = c(0.05, 0.15))) +
  labs(subtitle = "Between people: is a person's usual voice linked to their average UPDRS? (n = 42)",
       x = "Person's average voice score (higher = worse)", y = "Average motor UPDRS")

# B: inside each person, are worse-voice sessions the higher-UPDRS sessions?
fig9b_data <- sessions |>
  group_by(subject) |>
  summarise(Jitter  = cor(jitter_score, motor_updrs, method = "spearman"),
            Shimmer = cor(shimmer_score, motor_updrs, method = "spearman"),
            Noise   = cor(noise_score, motor_updrs, method = "spearman")) |>
  pivot_longer(-subject, names_to = "score", values_to = "rho") |>
  mutate(score = factor(score, levels = rev(score_levels)))

fig9b_median <- fig9b_data |> group_by(score) |> summarise(rho = median(rho))

fig9b <- ggplot(fig9b_data, aes(rho, score)) +
  geom_vline(xintercept = 0, colour = axis_col, linewidth = 0.6) +
  geom_point(position = position_jitter(height = 0.18, seed = 1),
             shape = 21, fill = orange, colour = "white", size = 2.4, stroke = 0.5) +
  geom_point(data = fig9b_median, shape = "|", size = 9, colour = ink) +
  geom_text(data = fig9b_median, aes(label = sprintf("median %.2f", rho)),
            nudge_y = 0.36, size = 2.9, colour = ink) +
  scale_x_continuous(limits = c(-1, 1)) +
  labs(subtitle = "Within a person: across one person's sessions, does a worse voice go with a higher UPDRS? (1 dot = 1 person)",
       x = "Spearman correlation between session voice score and motor UPDRS", y = NULL) +
  theme(panel.grid.major.y = element_blank())

fig9 <- fig9a / fig9b +
  plot_layout(heights = c(1.15, 1)) +
  plot_annotation(
    title = "Worse voices tend to go with worse UPDRS between people, but not within a person over time",
    tag_levels = "A",
    caption = "Panel B uses session averages (about 24 per person). Within-person correlations scatter evenly around zero."
  )

save_fig(fig9, "fig09_between_vs_within", width = 10, height = 8)


# ---- Fig 10. Did people whose voice worsened also get worse? ----
fig10_data <- voice_change |> mutate(score = factor(score, levels = score_levels))
fig10_rho <- fig10_data |>
  group_by(score) |>
  summarise(rho = cor(voice_change, motor_change, method = "spearman"),
            x = min(voice_change), y = max(motor_change))

fig10 <- ggplot(fig10_data, aes(voice_change, motor_change)) +
  geom_hline(yintercept = 0, colour = axis_col) +
  geom_vline(xintercept = 0, colour = axis_col) +
  geom_smooth(method = "lm", formula = y ~ x, colour = ink_soft, fill = "#e9e8e2", linewidth = 0.7) +
  geom_point(shape = 21, fill = blue, colour = "white", size = 2.6, stroke = 0.6) +
  geom_text(data = fig10_rho, aes(-Inf, Inf, label = sprintf("Spearman ρ = %.2f", rho)),
            hjust = -0.05, vjust = 1.2, size = 3.1, colour = ink) +
  facet_wrap(~score, scales = "free_x") +
  scale_y_continuous(expand = expansion(mult = c(0.05, 0.15))) +
  labs(
    title = "People whose voice worsened did not get worse symptoms",
    subtitle = "Each dot is one person. Voice change = average score in the last 2 weeks minus the first 2 weeks.\nStart and end are closest to the clinic visits, so this leans least on interpolated UPDRS.",
    x = "Change in voice score (positive = voice got worse)", y = "Change in motor UPDRS"
  )

save_fig(fig10, "fig10_voice_change_vs_updrs_change", width = 9, height = 4.5)


# ---- Fig 11. Aim 2: age, sex and UPDRS ----
aim2_motor <- lm(mean_motor ~ age + sex, data = people)
aim2_total <- lm(mean_total ~ age + sex, data = people)
summary(aim2_motor)
summary(aim2_total)
age_coef <- coef(summary(aim2_motor))["age", ]

fig11a_data <- people |>
  pivot_longer(c(mean_motor, mean_total), names_to = "outcome", values_to = "updrs") |>
  mutate(outcome = if_else(outcome == "mean_motor", "Motor UPDRS", "Total UPDRS"))

fig11a <- ggplot(fig11a_data, aes(age, updrs)) +
  geom_smooth(method = "lm", formula = y ~ x, colour = ink_soft, fill = "#e9e8e2", linewidth = 0.7) +
  geom_point(aes(fill = sex), shape = 21, colour = "white", size = 2.6, stroke = 0.6) +
  facet_wrap(~outcome, scales = "free_y") +
  scale_fill_manual(values = col_sex, name = NULL) +
  labs(subtitle = sprintf("Older people tended to have higher UPDRS: +%.1f motor points per 10 years (p = %.3f, adjusted for sex)",
                          10 * age_coef["Estimate"], age_coef["Pr(>|t|)"]),
       x = "Age (years)", y = "Average UPDRS")

fig11b <- ggplot(people, aes(age, progression)) +
  geom_boxplot(width = 0.5, outlier.shape = NA, colour = axis_col, fill = NA) +
  geom_point(position = position_jitter(height = 0.12, seed = 1), size = 2.2, colour = ink_soft) +
  scale_y_discrete(limits = rev) +
  labs(subtitle = "Age by progression group", x = "Age (years)", y = NULL) +
  theme(panel.grid.major.y = element_blank())

fig11c_data <- count(people, progression, sex)
fig11c <- ggplot(fig11c_data, aes(n, progression, fill = sex)) +
  geom_col(position = position_dodge(width = 0.75), width = 0.7) +
  geom_text(aes(label = n), position = position_dodge(width = 0.75), hjust = -0.4, size = 3) +
  scale_fill_manual(values = col_sex, name = NULL) +
  scale_y_discrete(limits = rev) +
  scale_x_continuous(expand = expansion(mult = c(0, 0.15))) +
  labs(subtitle = "People in each group, by sex", x = "People", y = NULL) +
  theme(panel.grid.major.y = element_blank(), legend.position = "none")

fig11 <- fig11a / (fig11b | fig11c) +
  plot_layout(heights = c(1.2, 1)) +
  plot_annotation(
    title = "Aim 2: age, sex and symptom severity",
    tag_levels = "A",
    caption = "One row per person (n = 42: 28 men, 14 women). Lines are linear fits with 95% bands."
  )

save_fig(fig11, "fig11_aim2_age_sex", width = 9, height = 7.5)


# ---- Fig 12. Aim 3: can voice predict UPDRS for a NEW person? ----
# Same models, two ways of testing them:
#   Random split: recordings shuffled into 5 folds (same person in train and test)
#   Leave one person out: train on 41 people, predict the 42nd
pred_data <- pad |>
  select(subject, motor_updrs, total_updrs, all_of(voice_vars)) |>
  mutate(across(all_of(setdiff(voice_vars, "hnr")), log))

folds <- list(
  "Random split"         = sample(rep(1:5, length.out = nrow(pred_data))),
  "Leave one person out" = as.integer(pred_data$subject)
)

aim3_error <- tibble()
aim3_pred  <- tibble()
for (y in c("motor_updrs", "total_updrs")) {
  f <- reformulate(voice_vars, y)
  for (scheme in names(folds)) {
    fold <- folds[[scheme]]
    p_mean <- p_lm <- p_rf <- numeric(nrow(pred_data))
    for (k in unique(fold)) {
      test  <- fold == k
      train <- pred_data[!test, ]
      p_mean[test] <- mean(train[[y]])
      p_lm[test]   <- predict(lm(f, data = train), pred_data[test, ])
      rf           <- ranger(f, data = train, num.trees = 200, seed = 1)
      p_rf[test]   <- predict(rf, pred_data[test, ])$predictions
    }
    actual <- pred_data[[y]]
    aim3_error <- bind_rows(aim3_error, tibble(
      outcome = y, scheme = scheme,
      model   = c("Average (no voice)", "Linear regression", "Random forest"),
      mae     = c(mean(abs(actual - p_mean)), mean(abs(actual - p_lm)), mean(abs(actual - p_rf)))
    ))
    aim3_pred <- bind_rows(aim3_pred, tibble(
      outcome = y, scheme = scheme, subject = pred_data$subject,
      actual = actual, predicted = p_rf
    ))
  }
}
aim3_error

fig12a_data <- aim3_error |>
  mutate(outcome = if_else(outcome == "motor_updrs", "Motor UPDRS", "Total UPDRS"),
         model   = factor(model, levels = rev(c("Average (no voice)", "Linear regression", "Random forest"))),
         scheme  = factor(scheme, levels = names(col_scheme)))

fig12a <- ggplot(fig12a_data, aes(mae, model)) +
  geom_line(aes(group = model), colour = axis_col, linewidth = 1.2) +
  geom_point(aes(fill = scheme), shape = 21, colour = "white", size = 3.6, stroke = 0.8) +
  geom_text(aes(label = sprintf("%.1f", mae), colour = scheme,
                hjust = if_else(scheme == "Random split", 1.6, -0.6)), size = 3, show.legend = FALSE) +
  facet_wrap(~outcome, scales = "free_x") +
  scale_fill_manual(values = col_scheme, name = NULL) +
  scale_colour_manual(values = col_scheme) +
  scale_x_continuous(limits = c(0, NA), expand = expansion(mult = c(0, 0.12))) +
  labs(subtitle = "Mean absolute error (lower is better)", x = "Mean absolute error (UPDRS points)", y = NULL) +
  theme(panel.grid.major.y = element_blank())

# B: random forest, one dot per person (average prediction vs actual)
fig12b_data <- aim3_pred |>
  filter(outcome == "motor_updrs") |>
  group_by(scheme, subject) |>
  summarise(actual = mean(actual), predicted = mean(predicted), .groups = "drop") |>
  mutate(scheme = factor(scheme, levels = names(col_scheme)))

fig12b <- ggplot(fig12b_data, aes(actual, predicted, fill = scheme)) +
  geom_abline(slope = 1, intercept = 0, colour = axis_col, linewidth = 0.6) +
  geom_point(shape = 21, colour = "white", size = 2.6, stroke = 0.6) +
  facet_wrap(~scheme) +
  scale_fill_manual(values = col_scheme, guide = "none") +
  coord_equal(xlim = c(5, 40), ylim = c(5, 40)) +
  labs(subtitle = "Random forest, motor UPDRS: each dot is one person's average (grey line = perfect)",
       x = "Actual motor UPDRS", y = "Predicted motor UPDRS")

fig12 <- fig12a / fig12b +
  plot_layout(heights = c(1, 1.3)) +
  plot_annotation(
    title = "Voice beats a simple average only for people the model has already seen",
    subtitle = "With a random split, the same person is in training and testing, so the model can recognise them.\nLeaving whole people out is the honest test for a new patient, and there every model loses to the average.",
    tag_levels = "A",
    caption = "Predictors: the 11 logged voice measures.\nTsanas et al. (2010) reported ~7.5 points for total UPDRS when testing on held-out recordings, not held-out people."
  )

save_fig(fig12, "fig12_aim3_prediction", width = 9, height = 9)


# ---- Fig 13. Aim 4: PD vs healthy in the Oxford data ----
aim4 <- puc_people |>
  pivot_longer(c(Jitter, Shimmer, Noise), names_to = "score", values_to = "value") |>
  group_by(score) |>
  summarise(p = wilcox.test(value ~ group, exact = FALSE)$p.value,
            y = max(value)) |>
  mutate(p_adj = p.adjust(p, method = "BH"),
         score = factor(score, levels = score_levels))
aim4

fig13_data <- puc_people |>
  pivot_longer(c(Jitter, Shimmer, Noise), names_to = "score", values_to = "value") |>
  mutate(score = factor(score, levels = score_levels))

fig13 <- ggplot(fig13_data, aes(group, value, colour = group)) +
  geom_hline(yintercept = 0, colour = axis_col) +
  geom_boxplot(width = 0.45, outlier.shape = NA, colour = axis_col, fill = NA) +
  geom_point(position = position_jitter(width = 0.12, seed = 1), size = 2.4) +
  geom_text(data = aim4, aes(x = 1.5, y = y + 0.35, label = sprintf("adjusted p = %.3f", p_adj)),
            inherit.aes = FALSE, size = 3, colour = ink) +
  facet_wrap(~score) +
  scale_colour_manual(values = col_group, guide = "none") +
  scale_y_continuous(expand = expansion(mult = c(0.05, 0.12))) +
  labs(
    title = "People with PD have worse voice scores than healthy people",
    subtitle = "Oxford clinic data, averaged to one value per person (24 PD, 8 healthy).\nWilcoxon tests, Benjamini–Hochberg corrected across the 3 scores.",
    x = NULL, y = "Average voice score (higher = worse)",
    caption = "Data: UCI Parkinson's (Little et al., 2009). Scores are z-scored within this dataset, so 0 = the dataset average."
  ) +
  theme(panel.grid.major.x = element_blank())

save_fig(fig13, "fig13_aim4_pd_vs_healthy", width = 8, height = 5)
