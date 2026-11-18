# export.R — writes the data behind the project website (docs/)
#
# Run from the project root (open Parkinson-s.Rproj, or `cd` to the repo):
#     Rscript scripts/export.R            # reruns everything from the raw data (~2 min)
#     Rscript scripts/export.R --fast     # reuses output/aims_3_4/aim3_predictions.csv
#
# It repeats the team's analysis code and saves the results as JSON:
#   Wrangling        from scripts/PD.PROJECT.Rmd
#   Aims 1 and 2     from scripts/aims_1_2_slides.R  (section 1 and 2, no figures)
#   Aims 3 and 4     from scripts/Aims_3_and_4.Rmd
# Blocks marked "COPIED FROM" are the same code as the source file. If you change
# an analysis script, change the matching block here, or the site will be stale.
#
# Output: docs/data/*.json, plus docs/data/data.js (the same JSON in one file, so
# that index.html also works when opened by double-click).
#
# Packages: tidyverse, lmerTest, ranger, jsonlite

suppressPackageStartupMessages({
  library(tidyverse)
  library(lmerTest)
  library(ranger)
  library(jsonlite)
})

args      <- commandArgs(trailingOnly = TRUE)
fast      <- "--fast" %in% args
out_dir   <- "docs/data"
repo_url  <- "https://github.com/linethan04/Parkinson-s"
pad_path  <- "data/parkinsons+telemonitoring/parkinsons_updrs.data"
puc_path  <- "data/parkinsons.data"
saved_dir <- "output/aims_3_4"

stopifnot("Run this from the project root" = file.exists(pad_path), file.exists(puc_path))
dir.create(out_dir, recursive = TRUE, showWarnings = FALSE)

site <- list()   # everything the site needs, one element per JSON file


# =====================================================================
# 1. WRANGLING  (scripts/PD.PROJECT.Rmd)
# =====================================================================

# Same raw files and paths as the Rmd (which knits from the project root).
pad.df <- read_csv(pad_path, show_col_types = FALSE)
puc.df <- read_csv(puc_path, show_col_types = FALSE)

# ---- COPIED FROM PD.PROJECT.Rmd, chunk "checks" ----
checks <- list(
  pad = list(rows = nrow(pad.df), cols = ncol(pad.df),
             missing = sum(is.na(pad.df)), duplicates = sum(duplicated(pad.df))),
  puc = list(rows = nrow(puc.df), cols = ncol(puc.df),
             missing = sum(is.na(puc.df)), duplicates = sum(duplicated(puc.df)))
)

# ---- COPIED FROM PD.PROJECT.Rmd, chunk "clean-pad" ----
pad_clean <- pad.df %>%
  transmute(
    subject       = `subject#`,
    age,
    sex           = if_else(sex == 0, "male", "female"),
    test_time,
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

# ---- COPIED FROM PD.PROJECT.Rmd, chunk "clean-puc" ----
puc_clean <- puc.df %>%
  transmute(
    subject       = str_extract(name, "S\\d{2}"),
    group         = if_else(status == 0, "healthy", "PD"),
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

shape_cleaned <- list(pad = dim(pad_clean), puc = dim(puc_clean))

# ---- COPIED FROM PD.PROJECT.Rmd, chunk "voice-scores" ----
add_voice_scores <- function(data) {
  data %>%
    mutate(
      jitter_score  = rowMeans(scale(across(starts_with("jitter")))),
      shimmer_score = rowMeans(scale(across(starts_with("shimmer")))),
      noise_score   = rowMeans(scale(cbind(nhr, -hnr)))
    )
}

pad_clean <- add_voice_scores(pad_clean)
puc_clean <- add_voice_scores(puc_clean)

shape_scored <- list(pad = dim(pad_clean), puc = dim(puc_clean))

# ---- COPIED FROM PD.PROJECT.Rmd, chunk "between-within" ----
pad_clean <- pad_clean %>%
  group_by(subject) %>%
  mutate(
    jitter_person  = mean(jitter_score),
    jitter_diff    = jitter_score - jitter_person,
    shimmer_person = mean(shimmer_score),
    shimmer_diff   = shimmer_score - shimmer_person,
    noise_person   = mean(noise_score),
    noise_diff     = noise_score - noise_person
  ) %>%
  ungroup()

shape_split <- list(pad = dim(pad_clean), puc = dim(puc_clean))

# ---- COPIED FROM PD.PROJECT.Rmd, chunk "progression" ----
pad_people <- pad_clean %>%
  arrange(subject, test_time) %>%
  group_by(subject) %>%
  summarise(
    age              = first(age),
    sex              = first(sex),
    mean_motor_updrs = mean(motor_updrs),
    mean_total_updrs = mean(total_updrs),
    motor_change     = last(motor_updrs) - first(motor_updrs)
  ) %>%
  mutate(
    progression = case_when(
      motor_change >= 2.5  ~ "worsened",
      motor_change <= -2.5 ~ "improved",
      TRUE                 ~ "stable"
    )
  )
# ---- end of copied wrangling code ----

# What happened to every raw column. Checked against the cleaned tables below.
fate <- function(raw, new, family, action = "keep", reason = NA_character_) {
  tibble(raw = raw, new = new, family = family, action = action, reason = reason)
}
r_redundant <- "Redundant: exactly 3 times another column"
r_proposal  <- "Irrelevant: not in our proposal, and DFA differs between the two studies"
r_oxford    <- "Irrelevant: only in the Oxford study, and not used in our analysis plan"

pad_columns <- bind_rows(
  fate("subject#",      "subject",       "id"),
  fate("age",           "age",           "context"),
  fate("sex",           "sex",           "context"),
  fate("test_time",     "test_time",     "context"),
  fate("motor_UPDRS",   "motor_updrs",   "outcome"),
  fate("total_UPDRS",   "total_updrs",   "outcome"),
  fate("Jitter(%)",     "jitter_pct",    "jitter"),
  fate("Jitter(Abs)",   "jitter_abs",    "jitter"),
  fate("Jitter:RAP",    "jitter_rap",    "jitter"),
  fate("Jitter:PPQ5",   "jitter_ppq5",   "jitter"),
  fate("Jitter:DDP",    NA,              "jitter",  "drop", r_redundant),
  fate("Shimmer",       "shimmer",       "shimmer"),
  fate("Shimmer(dB)",   "shimmer_db",    "shimmer"),
  fate("Shimmer:APQ3",  "shimmer_apq3",  "shimmer"),
  fate("Shimmer:APQ5",  "shimmer_apq5",  "shimmer"),
  fate("Shimmer:APQ11", "shimmer_apq11", "shimmer"),
  fate("Shimmer:DDA",   NA,              "shimmer", "drop", r_redundant),
  fate("NHR",           "nhr",           "noise"),
  fate("HNR",           "hnr",           "noise"),
  fate("RPDE",          NA,              "other",   "drop", r_proposal),
  fate("DFA",           NA,              "other",   "drop", r_proposal),
  fate("PPE",           NA,              "other",   "drop", r_proposal)
)

puc_columns <- bind_rows(
  fate("name",             "subject",       "id"),
  fate("MDVP:Fo(Hz)",      NA,              "other",   "drop", r_oxford),
  fate("MDVP:Fhi(Hz)",     NA,              "other",   "drop", r_oxford),
  fate("MDVP:Flo(Hz)",     NA,              "other",   "drop", r_oxford),
  fate("MDVP:Jitter(%)",   "jitter_pct",    "jitter"),
  fate("MDVP:Jitter(Abs)", "jitter_abs",    "jitter"),
  fate("MDVP:RAP",         "jitter_rap",    "jitter"),
  fate("MDVP:PPQ",         "jitter_ppq5",   "jitter"),
  fate("Jitter:DDP",       NA,              "jitter",  "drop", r_redundant),
  fate("MDVP:Shimmer",     "shimmer",       "shimmer"),
  fate("MDVP:Shimmer(dB)", "shimmer_db",    "shimmer"),
  fate("Shimmer:APQ3",     "shimmer_apq3",  "shimmer"),
  fate("Shimmer:APQ5",     "shimmer_apq5",  "shimmer"),
  fate("MDVP:APQ",         "shimmer_apq11", "shimmer"),
  fate("Shimmer:DDA",      NA,              "shimmer", "drop", r_redundant),
  fate("NHR",              "nhr",           "noise"),
  fate("HNR",              "hnr",           "noise"),
  fate("status",           "group",         "context"),
  fate("RPDE",             NA,              "other",   "drop", r_proposal),
  fate("DFA",              NA,              "other",   "drop", r_proposal),
  fate("spread1",          NA,              "other",   "drop", r_oxford),
  fate("spread2",          NA,              "other",   "drop", r_oxford),
  fate("D2",               NA,              "other",   "drop", r_oxford),
  fate("PPE",              NA,              "other",   "drop", r_proposal)
)

voice_vars <- c("jitter_pct", "jitter_abs", "jitter_rap", "jitter_ppq5",
                "shimmer", "shimmer_db", "shimmer_apq3", "shimmer_apq5",
                "shimmer_apq11", "nhr", "hnr")

# The table above must describe the real files and the real cleaned tables
stopifnot(
  identical(pad_columns$raw, names(pad.df)),
  identical(puc_columns$raw, names(puc.df)),
  identical(na.omit(pad_columns$new) |> as.character(), names(pad_clean)[1:shape_cleaned$pad[2]]),
  setequal(na.omit(puc_columns$new), names(puc_clean)[1:shape_cleaned$puc[2]]),
  all(voice_vars %in% names(pad_clean)), all(voice_vars %in% names(puc_clean)),
  nrow(pad_clean) == 5875, nrow(puc_clean) == 195, nrow(pad_people) == 42
)

# Facts quoted in the wrangling chapter
negative_time <- pad.df %>%
  filter(test_time < 0) %>%
  count(subject = `subject#`, day = floor(test_time), name = "n_recordings")

puc_ids <- puc_clean %>% distinct(subject, group) %>% count(group, name = "n_people")
rec_per_person <- count(pad.df, `subject#`)$n

quality <- list(
  negative_time_rows     = sum(pad.df$test_time < 0),
  negative_time_sessions = negative_time,
  puc_documentation      = list(people = 31, pd = 23),   # as written in data/parkinsons.names
  puc_file               = list(people = n_distinct(puc_clean$subject),
                                pd      = puc_ids$n_people[puc_ids$group == "PD"],
                                healthy = puc_ids$n_people[puc_ids$group == "healthy"]),
  redundancy_max_abs_diff = list(
    pad_ddp_vs_3rap  = max(abs(pad.df$`Jitter:DDP`  - 3 * pad.df$`Jitter:RAP`)),
    pad_dda_vs_3apq3 = max(abs(pad.df$`Shimmer:DDA` - 3 * pad.df$`Shimmer:APQ3`)),
    puc_ddp_vs_3rap  = max(abs(puc.df$`Jitter:DDP`  - 3 * puc.df$`MDVP:RAP`)),
    puc_dda_vs_3apq3 = max(abs(puc.df$`Shimmer:DDA` - 3 * puc.df$`Shimmer:APQ3`))
  ),
  dfa_median = list(pad_pd = median(pad.df$DFA),
                    puc_pd = median(puc.df$DFA[puc.df$status == 1])),
  recordings_per_person = list(min = min(rec_per_person), max = max(rec_per_person),
                               mean = mean(rec_per_person)),
  test_time_range = range(pad.df$test_time),
  home_sessions   = nrow(distinct(pad.df, `subject#`, floor(test_time)))
)

site$wrangling <- list(
  checks      = checks,
  pad_columns = pad_columns,
  puc_columns = puc_columns,
  measures    = voice_vars,
  shapes = list(
    raw     = list(pad = dim(pad.df),         puc = dim(puc.df)),
    cleaned = shape_cleaned,
    scored  = shape_scored,
    split   = shape_split,
    people  = list(pad_people = dim(pad_people))
  ),
  new_columns = list(
    scores = c("jitter_score", "shimmer_score", "noise_score"),
    split  = c("jitter_person", "jitter_diff", "shimmer_person", "shimmer_diff",
               "noise_person", "noise_diff"),
    people = names(pad_people)
  ),
  progression_counts = count(pad_people, progression),
  quality = quality,
  preview = list(
    pad_raw    = head(pad.df, 4),
    puc_raw    = head(puc.df, 4),
    pad_clean  = head(pad_clean, 4),
    puc_clean  = head(puc_clean, 4),
    pad_people = head(pad_people, 4)
  )
)


# =====================================================================
# 2. AIMS 1 AND 2  (scripts/aims_1_2_slides.R, sections 1 and 2)
# =====================================================================

# ---- COPIED FROM aims_1_2_slides.R, "1. Load and clean" ----
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

# ---- COPIED FROM aims_1_2_slides.R, "2. Numbers used on the slides" ----
# ICC: share of UPDRS variation that is between people
icc <- function(y) {
  vc <- as.data.frame(VarCorr(lmer(reformulate("(1 | subject)", y), data = pad)))$vcov
  vc[1] / sum(vc)
}
icc_motor <- icc("motor_updrs")
icc_total <- icc("total_updrs")

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

# Within-person correlations (session level), one per person
within_rho <- sessions |>
  group_by(subject) |>
  summarise(Jitter  = cor(jitter_score, motor_updrs, method = "spearman"),
            Shimmer = cor(shimmer_score, motor_updrs, method = "spearman"),
            Noise   = cor(noise_score, motor_updrs, method = "spearman")) |>
  pivot_longer(-subject, names_to = "score", values_to = "rho")
within_median <- within_rho |> group_by(score) |> summarise(median = median(rho))

# Between-person correlations (n = 42)
between_rho <- people |>
  summarise(across(c(jitter, shimmer, noise), ~ cor(.x, mean_motor, method = "spearman")))

# Aim 2: one row per person
aim2_motor <- lm(mean_motor ~ age + sex, data = people)
aim2_total <- lm(mean_total ~ age + sex, data = people)
sex_means  <- people |> group_by(sex) |> summarise(n = n(), motor = mean(mean_motor), total = mean(mean_total))
sex_ttest  <- t.test(mean_motor ~ sex, data = people)
prog_age   <- people |> group_by(progression) |> summarise(n = n(), median_age = median(age))
prog_kw    <- kruskal.test(age ~ progression, data = people)

# Does age explain the between-person voice effect? (links Aim 1 and Aim 2)
adj <- tibble()
for (s in c("jitter", "shimmer", "noise")) {
  fit1 <- coef(summary(lm(reformulate(s, "mean_motor"), data = people)))[s, ]
  fit2 <- coef(summary(lm(reformulate(c(s, "age", "sex"), "mean_motor"), data = people)))[s, ]
  adj <- bind_rows(adj, tibble(score = s, crude = fit1[1], crude_p = fit1[4],
                               adjusted = fit2[1], adjusted_p = fit2[4]))
}
voice_age_r <- people |> summarise(across(c(jitter, shimmer, noise), ~ cor(.x, age)))
# ---- end of copied Aim 1 and 2 code ----

# The two scripts must agree on the people table
stopifnot(
  all.equal(people$motor_change, pad_people$motor_change),
  all.equal(people$mean_motor,   pad_people$mean_motor_updrs),
  identical(tolower(as.character(people$progression)), pad_people$progression)
)

# Extra columns for the site, taken from the same tables
first_last <- pad |>
  arrange(subject, test_time) |>
  group_by(subject) |>
  summarise(n_recordings = n(), first_day = first(test_time), last_day = last(test_time),
            first_motor = first(motor_updrs), last_motor = last(motor_updrs))

site$people <- people |>
  left_join(first_last, by = "subject") |>
  transmute(subject = as.integer(as.character(subject)), age, sex, n_recordings,
            first_day, last_day, mean_motor, mean_total, first_motor, last_motor,
            motor_change, progression = as.character(progression),
            jitter_person = jitter, shimmer_person = shimmer, noise_person = noise)

# Recording-level table, stored column by column to keep the file small.
# Scores are the ones the Aim 1 models used (logged, from aims_1_2_slides.R).
site$recordings <- pad |>
  transmute(subject = as.integer(as.character(subject)),
            test_time, motor_updrs, total_updrs,
            across(c(jitter_score, shimmer_score, noise_score,
                     jitter_person, shimmer_person, noise_person,
                     jitter_diff, shimmer_diff, noise_diff), ~ round(.x, 4))) |>
  as.list()

site$sessions <- sessions |>
  transmute(subject = as.integer(as.character(subject)), session,
            months = round(months, 4), motor_updrs = round(motor_updrs, 4),
            total_updrs = round(total_updrs, 4),
            across(ends_with("_score"), ~ round(.x, 4))) |>
  as.list()

site$aim1 <- list(
  effects = aim1 |> mutate(score = as.character(score)),
  n_significant_after_bh = sum(aim1$p_adj < 0.05),
  icc = list(motor = icc_motor, total = icc_total),
  within_rho = within_rho |> mutate(subject = as.integer(as.character(subject))),
  within_rho_median = within_median,
  between_rho = as.list(between_rho),
  n_people = n_distinct(pad$subject), n_recordings = nrow(pad), n_sessions = nrow(sessions)
)

coef_table <- function(fit) {
  tab <- coef(summary(fit))
  ci  <- confint(fit)
  tibble(term = rownames(tab), estimate = tab[, "Estimate"], se = tab[, "Std. Error"],
         t = tab[, "t value"], p = tab[, "Pr(>|t|)"], lower = ci[, 1], upper = ci[, 2])
}
fit_line <- function(fit) {
  grid <- expand_grid(age = seq(min(people$age), max(people$age), length.out = 25),
                      sex = c("Male", "Female"))
  bind_cols(grid, as_tibble(predict(fit, grid, interval = "confidence")))
}

# How the progression groups change with the cut-off (2.5 is the published value).
# Same rule as PD.PROJECT.Rmd, repeated for cut-offs 0.5, 0.6, ... 6.0.
mcid_grid <- map_dfr(5:60, function(k) {
  cut <- k / 10
  g <- factor(case_when(people$motor_change >= cut  ~ "Worsened",
                        people$motor_change <= -cut ~ "Improved",
                        TRUE                        ~ "Stable"),
              levels = c("Worsened", "Stable", "Improved"))
  med <- tapply(people$age, g, median)
  tibble(cutoff = cut,
         n_worsened = sum(g == "Worsened"), n_stable = sum(g == "Stable"), n_improved = sum(g == "Improved"),
         median_age_worsened = med[["Worsened"]], median_age_stable = med[["Stable"]],
         median_age_improved = med[["Improved"]],
         kw_p = if (n_distinct(g) > 1) kruskal.test(people$age, g)$p.value else NA_real_)
})
stopifnot(with(filter(mcid_grid, cutoff == 2.5), n_worsened == 20 & n_stable == 13 & n_improved == 9))

site$aim2 <- list(
  motor = list(coefficients = coef_table(aim2_motor), r_squared = summary(aim2_motor)$r.squared,
               line = fit_line(aim2_motor)),
  total = list(coefficients = coef_table(aim2_total), r_squared = summary(aim2_total)$r.squared,
               line = fit_line(aim2_total)),
  sex_means = sex_means,
  sex_ttest_motor = list(t = unname(sex_ttest$statistic), df = unname(sex_ttest$parameter),
                         p = sex_ttest$p.value, ci = as.numeric(sex_ttest$conf.int)),
  progression = prog_age |> mutate(progression = as.character(progression)),
  progression_kruskal = list(statistic = unname(prog_kw$statistic), df = unname(prog_kw$parameter),
                             p = prog_kw$p.value),
  mcid_grid = mcid_grid,
  voice_adjusted = adj,
  voice_age_r = as.list(voice_age_r)
)


# =====================================================================
# 3. AIM 3  (scripts/Aims_3_and_4.Rmd)
# =====================================================================
# The Rmd reads data/pad_clean.csv and data/puc_clean.csv. The same tables are
# already in memory from section 1, so they are used directly.

# ---- COPIED FROM Aims_3_and_4.Rmd, chunk "prediction-data" ----
models <- c("Mean baseline", "Linear regression", "Random forest")
outcome_names <- c(motor_updrs = "Motor UPDRS", total_updrs = "Total UPDRS")

pred_data <- pad_clean |>
  select(subject, motor_updrs, total_updrs, all_of(voice_vars)) |>
  mutate(across(all_of(setdiff(voice_vars, "hnr")), log))

set.seed(2026)
folds <- list(
  "Random rows" = sample(rep(1:5, length.out = nrow(pred_data))),
  "New person" = match(pred_data$subject, unique(pred_data$subject))
)

# ---- COPIED FROM Aims_3_and_4.Rmd, chunk "aim3-models" ----
cross_validate <- function(outcome, scheme) {
  fold <- folds[[scheme]]
  model_formula <- reformulate(voice_vars, response = outcome)

  predictions <- matrix(
    NA_real_,
    nrow = nrow(pred_data),
    ncol = length(models),
    dimnames = list(NULL, models)
  )

  for (k in unique(fold)) {
    test <- fold == k
    training <- pred_data[!test, ]
    testing <- pred_data[test, ]

    linear_model <- lm(model_formula, data = training)

    forest_model <- ranger(
      model_formula,
      data = training,
      num.trees = 200,
      mtry = 3,
      min.node.size = 5,
      seed = 2026,
      num.threads = 2
    )

    predictions[test, "Mean baseline"] <- mean(training[[outcome]])
    predictions[test, "Linear regression"] <-
      predict(linear_model, newdata = testing)
    predictions[test, "Random forest"] <-
      predict(forest_model, data = testing)$predictions
  }

  as_tibble(predictions) |>
    mutate(
      recording = seq_len(nrow(pred_data)),
      subject = pred_data$subject,
      actual = pred_data[[outcome]],
      outcome = outcome,
      scheme = scheme,
      fold = fold
    ) |>
    pivot_longer(
      cols = all_of(models),
      names_to = "model",
      values_to = "predicted"
    )
}
# ---- end of copied block ----

saved_pred <- file.path(saved_dir, "aim3_predictions.csv")
if (fast && file.exists(saved_pred)) {
  message("Aim 3: reading saved predictions from ", saved_pred)
  aim3_predictions <- read_csv(saved_pred, show_col_types = FALSE)
  aim3_source <- "saved output/aims_3_4/aim3_predictions.csv"
} else {
  message("Aim 3: refitting the models (about 2 minutes) ...")
  aim3_predictions <- expand_grid(
    outcome = c("motor_updrs", "total_updrs"),
    scheme = names(folds)
  ) |>
    pmap(cross_validate) |>
    bind_rows()
  aim3_source <- "refitted by export.R"
}

# ---- COPIED FROM Aims_3_and_4.Rmd, chunk "aim3-errors" ----
aim3_predictions <- aim3_predictions |>
  mutate(absolute_error = abs(actual - predicted))

person_errors <- aim3_predictions |>
  group_by(outcome, scheme, model, subject) |>
  summarise(person_mae = mean(absolute_error), .groups = "drop")

equal_person_errors <- person_errors |>
  group_by(outcome, scheme, model) |>
  summarise(equal_person_mae = mean(person_mae), .groups = "drop")

aim3_errors <- aim3_predictions |>
  group_by(outcome, scheme, model) |>
  summarise(mae = mean(absolute_error), .groups = "drop") |>
  left_join(equal_person_errors, by = c("outcome", "scheme", "model")) |>
  mutate(
    outcome = unname(outcome_names[outcome]),
    scheme = factor(scheme, levels = names(folds)),
    model = factor(model, levels = models)
  )
# ---- end of copied block ----

# One row per person, outcome, test design and model (the Rmd's scatter uses these averages)
aim3_people <- aim3_predictions |>
  group_by(outcome, scheme, model, subject) |>
  summarise(n_recordings = n(), actual = mean(actual), predicted = mean(predicted),
            person_mae = mean(absolute_error), .groups = "drop") |>
  mutate(outcome = unname(outcome_names[outcome]))

# In a random split, how much of each tested person is also in the training folds?
train_share <- tibble(subject = pred_data$subject, fold = folds[["Random rows"]]) |>
  count(subject, fold) |>
  group_by(subject) |>
  mutate(share_in_training = 1 - n / sum(n)) |>
  ungroup()

site$aim3 <- list(
  source  = aim3_source,
  errors  = aim3_errors |> mutate(across(c(scheme, model), as.character)) |> arrange(outcome, scheme, model),
  people  = aim3_people,
  design  = list(
    predictors = voice_vars, n_recordings = nrow(pred_data), n_people = n_distinct(pred_data$subject),
    random_folds = 5, new_person_folds = n_distinct(folds[["New person"]]),
    forest = list(trees = 200, mtry = 3, min_node_size = 5, seed = 2026),
    random_rows_min_share_of_person_in_training = min(train_share$share_in_training),
    random_rows_people_always_in_training =
      all(tapply(train_share$fold, train_share$subject, n_distinct) == 5)
  ),
  # which random fold each recording fell in, in the same row order as recordings.json
  random_fold = folds[["Random rows"]]
)


# =====================================================================
# 4. AIM 4  (scripts/Aims_3_and_4.Rmd)
# =====================================================================

# ---- COPIED FROM Aims_3_and_4.Rmd, chunks "load-jasons-data", "aim4-people", "aim4-tests" ----
puc_aim4 <- puc_clean |>
  mutate(group = factor(tolower(group),
                        levels = c("healthy", "pd"),
                        labels = c("Healthy", "PD")))

puc_people <- puc_aim4 |>
  group_by(subject, group) |>
  summarise(across(ends_with("_score"), mean), .groups = "drop")

score_names <- c(
  jitter_score = "Jitter: pitch instability",
  shimmer_score = "Shimmer: loudness instability",
  noise_score = "Noise: noisier voice"
)

long_scores <- puc_people |>
  pivot_longer(
    cols = ends_with("_score"),
    names_to = "score",
    values_to = "value"
  ) |>
  mutate(score = factor(score, levels = names(score_names)))

aim4_tests <- long_scores |>
  group_by(score) |>
  summarise(
    n_pd = sum(group == "PD"),
    n_healthy = sum(group == "Healthy"),
    healthy_median = median(value[group == "Healthy"]),
    pd_median = median(value[group == "PD"]),
    U = unname(wilcox.test(
      value[group == "PD"], value[group == "Healthy"],
      alternative = "two.sided", exact = FALSE, correct = TRUE
    )$statistic),
    p = wilcox.test(
      value[group == "PD"], value[group == "Healthy"],
      alternative = "two.sided", exact = FALSE, correct = TRUE
    )$p.value,
    .groups = "drop"
  ) |>
  mutate(
    rank_biserial = 2 * U / (n_pd * n_healthy) - 1,
    p_adjusted = p.adjust(p, method = "BH")
  )
# ---- end of copied block ----

# Box-plot numbers (quartiles as ggplot2 draws them) and how much the groups overlap
aim4_boxes <- long_scores |>
  group_by(score, group) |>
  summarise(n = n(), min = min(value), q1 = quantile(value, 0.25), median = median(value),
            q3 = quantile(value, 0.75), max = max(value), .groups = "drop")

aim4_overlap <- long_scores |>
  group_by(score) |>
  summarise(healthy_max = max(value[group == "Healthy"]),
            n_pd_within_healthy_range = sum(group == "PD" & value <= max(value[group == "Healthy"])),
            n_pd = sum(group == "PD"), .groups = "drop")

site$aim4 <- list(
  people  = puc_people |> mutate(group = as.character(group)) |>
    left_join(count(puc_clean, subject, name = "n_recordings"), by = "subject"),
  tests   = aim4_tests |> mutate(score = as.character(score), label = unname(score_names[score])),
  boxes   = aim4_boxes |> mutate(across(c(score, group), as.character)),
  overlap = aim4_overlap |> mutate(score = as.character(score)),
  n_recordings = nrow(puc_clean)
)
site$wrangling$shapes$people$puc_people <- dim(puc_people)


# =====================================================================
# 5. R SNIPPETS shown on the site, read straight from the repo files
# =====================================================================
rmd_chunk <- function(file, label) {
  lines <- readLines(file, warn = FALSE)
  start <- grep(paste0("^```\\{r ", label, "[,}]"), lines)
  stopifnot("chunk not found" = length(start) == 1)
  end <- start + which(lines[(start + 1):length(lines)] == "```")[1]
  list(file = file, label = label, from = start + 1, to = end - 1,
       code = paste(lines[(start + 1):(end - 1)], collapse = "\n"))
}
r_section <- function(file, from_pattern, until_pattern, label) {
  lines <- readLines(file, warn = FALSE)
  start <- grep(from_pattern, lines)[1]
  end   <- start + grep(until_pattern, lines[(start + 1):length(lines)])[1] - 1
  while (trimws(lines[end]) == "") end <- end - 1
  stopifnot("section not found" = !is.na(start), !is.na(end))
  list(file = file, label = label, from = start, to = end,
       code = paste(lines[start:end], collapse = "\n"))
}
wr <- "scripts/PD.PROJECT.Rmd"; s12 <- "scripts/aims_1_2_slides.R"; a34 <- "scripts/Aims_3_and_4.Rmd"

site$snippets <- list(
  checks       = rmd_chunk(wr, "checks"),
  clean_pad    = rmd_chunk(wr, "clean-pad"),
  clean_puc    = rmd_chunk(wr, "clean-puc"),
  voice_scores = rmd_chunk(wr, "voice-scores"),
  split        = rmd_chunk(wr, "between-within"),
  progression  = rmd_chunk(wr, "progression"),
  aim1_scores  = r_section(s12, "^# Voice scores: log the skewed", "^# One row per home session", "voice scores (Aims 1 and 2)"),
  aim1_models  = r_section(s12, "^# Aim 1: one mixed model", "^# Within-person correlations", "Aim 1 mixed models"),
  aim2_models  = r_section(s12, "^# Aim 2: one row per person", "^# Does age explain", "Aim 2 tests"),
  aim2_voice   = r_section(s12, "^# Does age explain", "^# =====", "voice, age and sex"),
  aim3_data    = rmd_chunk(a34, "prediction-data"),
  aim3_models  = rmd_chunk(a34, "aim3-models"),
  aim3_errors  = rmd_chunk(a34, "aim3-errors"),
  aim4_people  = rmd_chunk(a34, "aim4-people"),
  aim4_tests   = rmd_chunk(a34, "aim4-tests")
)

site$meta <- list(
  generated = format(Sys.Date()),
  r_version = R.version.string,
  packages  = sapply(c("tidyverse", "lme4", "lmerTest", "ranger", "jsonlite"),
                     function(p) as.character(packageVersion(p)), simplify = FALSE),
  seed = 2026,
  repo = repo_url,
  branch = "main",
  score_definitions = list(
    wrangling_and_aim4 = "z-score each measure, average within family (HNR reversed). PD.PROJECT.Rmd",
    aims_1_and_2 = "log the skewed measures, z-score, sum within family (HNR reversed), z-score again. aims_1_2_slides.R"
  )
)


# =====================================================================
# 6. WRITE
# =====================================================================
to_json <- function(x) toJSON(x, dataframe = "rows", auto_unbox = TRUE, digits = NA,
                              na = "null", null = "null")

for (name in names(site)) {
  writeLines(to_json(site[[name]]), file.path(out_dir, paste0(name, ".json")), useBytes = TRUE)
}
# One-file copy for opening index.html without a web server
writeLines(c("// Written by scripts/export.R. Do not edit by hand.",
             paste0("window.PD_DATA = ", to_json(site), ";")),
           file.path(out_dir, "data.js"), useBytes = TRUE)


# =====================================================================
# 7. CHECK against the saved Aim 3 and 4 results, and print the headline numbers
# =====================================================================
if (file.exists(file.path(saved_dir, "aim3_errors.csv"))) {
  saved3 <- read_csv(file.path(saved_dir, "aim3_errors.csv"), show_col_types = FALSE)
  cmp3 <- site$aim3$errors |> inner_join(saved3, by = c("outcome", "scheme", "model"), suffix = c("", "_saved"))
  cat(sprintf("\nAim 3 vs saved aim3_errors.csv:  largest MAE difference = %.2e (%d rows)\n",
              max(abs(cmp3$mae - cmp3$mae_saved)), nrow(cmp3)))
}
if (file.exists(file.path(saved_dir, "aim4_tests.csv"))) {
  saved4 <- read_csv(file.path(saved_dir, "aim4_tests.csv"), show_col_types = FALSE)
  cat(sprintf("Aim 4 vs saved aim4_tests.csv:   largest adjusted-p difference = %.2e\n",
              max(abs(aim4_tests$p_adjusted - saved4$p_adjusted[match(aim4_tests$score, saved4$score)]))))
}

cat("\n---- Headline numbers on the site ----\n")
cat(sprintf("Datasets: PAD %d x %d, %d people | PUC %d x %d, %d people (%d PD, %d healthy)\n",
            nrow(pad.df), ncol(pad.df), n_distinct(pad.df$`subject#`), nrow(puc.df), ncol(puc.df),
            quality$puc_file$people, quality$puc_file$pd, quality$puc_file$healthy))
cat(sprintf("Negative test_time rows: %d\n", quality$negative_time_rows))
cat("Aim 1 (UPDRS points per 1 SD worse voice):\n")
print(as.data.frame(aim1 |> transmute(outcome, score, part, estimate = round(estimate, 2),
                                      lower = round(lower, 2), upper = round(upper, 2),
                                      p_adj = round(p_adj, 3))), row.names = FALSE)
cat(sprintf("Aim 2 age, per decade: motor %+.1f (p = %.3f), total %+.1f (p = %.3f)\n",
            10 * coef(aim2_motor)["age"], coef(summary(aim2_motor))["age", 4],
            10 * coef(aim2_total)["age"], coef(summary(aim2_total))["age", 4]))
cat(sprintf("Aim 2 sex, men vs women: motor %+.1f (p = %.2f), total %+.1f (p = %.2f); %d women\n",
            coef(aim2_motor)["sexMale"], coef(summary(aim2_motor))["sexMale", 4],
            coef(aim2_total)["sexMale"], coef(summary(aim2_total))["sexMale", 4],
            sex_means$n[sex_means$sex == "Female"]))
cat(sprintf("Progression: %s | median age %s | Kruskal-Wallis p = %.2f\n",
            paste(prog_age$n, tolower(prog_age$progression), collapse = ", "),
            paste(prog_age$median_age, collapse = ", "), prog_kw$p.value))
cat(sprintf("Voice vs age (r): jitter %.2f, shimmer %.2f, noise %.2f\n",
            voice_age_r$jitter, voice_age_r$shimmer, voice_age_r$noise))
cat("Aim 3 MAE:\n")
print(as.data.frame(site$aim3$errors |> mutate(mae = round(mae, 2), equal_person_mae = round(equal_person_mae, 2))),
      row.names = FALSE)
cat("Aim 4:\n")
print(as.data.frame(aim4_tests |> transmute(score, U, p = round(p, 4), p_adjusted = round(p_adjusted, 3),
                                            rank_biserial = round(rank_biserial, 3))), row.names = FALSE)
cat("\nWrote", length(site), "JSON files and data.js to", out_dir, "\n")
