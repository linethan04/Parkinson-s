# Exploratory analysis of the Parkinson's Telemonitoring data
# Run from the project root

library(dplyr)
library(tidyr)
library(ggplot2)
library(lmerTest)  # loads lme4 and adds p-values

dir.create("output/eda", recursive = TRUE, showWarnings = FALSE)

# ---- Load data ----
pd <- read.csv("data/parkinsons+telemonitoring/parkinsons_updrs.data")

names(pd) <- c("subject", "age", "sex", "test_time", "motor_UPDRS", "total_UPDRS",
               "jitter_pct", "jitter_abs", "jitter_rap", "jitter_ppq5", "jitter_ddp",
               "shimmer", "shimmer_db", "shimmer_apq3", "shimmer_apq5",
               "shimmer_apq11", "shimmer_dda",
               "NHR", "HNR", "RPDE", "DFA", "PPE")

pd$subject <- factor(pd$subject)
pd$sex     <- factor(pd$sex, levels = c(0, 1), labels = c("Male", "Female"))
pd$months  <- pd$test_time / 30

voice_vars <- c("jitter_pct", "jitter_abs", "jitter_rap", "jitter_ppq5", "jitter_ddp",
                "shimmer", "shimmer_db", "shimmer_apq3", "shimmer_apq5",
                "shimmer_apq11", "shimmer_dda")
outcomes <- c("motor_UPDRS", "total_UPDRS")

# ---- Overview ----
dim(pd)
sum(is.na(pd))
summary(pd)
summary(as.vector(table(pd$subject)))  # recordings per patient

# One row per patient
patients <- pd %>%
  group_by(subject, age, sex) %>%
  summarise(motor_mean = mean(motor_UPDRS),
            total_mean = mean(total_UPDRS),
            .groups = "drop")

table(patients$sex)

# ---- UPDRS over time ----
ggplot(pd, aes(test_time, total_UPDRS, group = subject, colour = sex)) +
  geom_line() +
  labs(title = "Total UPDRS over the trial", x = "Days", y = "Total UPDRS")
ggsave("output/eda/updrs_over_time.png", width = 8, height = 4)

# Share of UPDRS variance that is between patients (ICC)
null_model <- lmer(total_UPDRS ~ 1 + (1 | subject), data = pd)
vc <- as.data.frame(VarCorr(null_model))$vcov
vc[1] / sum(vc)

# ---- Voice measures ----
# Skewed, so log-transform and standardise
for (v in voice_vars) {
  pd[[v]] <- as.numeric(scale(log(pd[[v]])))
}

pd %>%
  pivot_longer(all_of(voice_vars), names_to = "measure", values_to = "value") %>%
  ggplot(aes(value)) +
  geom_histogram(bins = 40) +
  facet_wrap(~measure)
ggsave("output/eda/voice_histograms.png", width = 10, height = 6)

round(cor(pd[, c(outcomes, voice_vars)]), 2)

# ---- Aim 1: voice measures vs UPDRS ----
# One mixed model per voice measure, with a random intercept per patient
aim1 <- data.frame()

for (y in outcomes) {
  for (v in voice_vars) {
    f   <- as.formula(paste(y, "~", v, "+ months + (1 | subject)"))
    fit <- lmer(f, data = pd)
    est <- coef(summary(fit))[v, ]
    aim1 <- rbind(aim1, data.frame(outcome  = y,
                                   measure  = v,
                                   estimate = est["Estimate"],
                                   se       = est["Std. Error"],
                                   p        = est["Pr(>|t|)"]))
  }
}

# Adjust p-values for testing 11 measures per outcome
aim1 <- aim1 %>%
  group_by(outcome) %>%
  mutate(p_adj = p.adjust(p, method = "BH")) %>%
  ungroup()
aim1

ggplot(aim1, aes(estimate, measure)) +
  geom_vline(xintercept = 0, linetype = "dashed") +
  geom_pointrange(aes(xmin = estimate - 1.96 * se, xmax = estimate + 1.96 * se)) +
  facet_wrap(~outcome) +
  labs(title = "Voice measure effects on UPDRS",
       x = "UPDRS points per 1 SD of log(measure)", y = NULL)
ggsave("output/eda/aim1_effects.png", width = 8, height = 5)

# Patient averages: do patients with worse voices have higher UPDRS?
patient_voice <- pd %>%
  group_by(subject) %>%
  summarise(shimmer_db = mean(shimmer_db), total_UPDRS = mean(total_UPDRS))

ggplot(patient_voice, aes(shimmer_db, total_UPDRS)) +
  geom_point() +
  geom_smooth(method = "lm") +
  labs(title = "Patient-average shimmer (dB) vs total UPDRS")
ggsave("output/eda/aim1_patient_shimmer.png", width = 6, height = 4)

# ---- Aim 2: age and sex vs UPDRS ----
ggplot(patients, aes(age, total_mean, colour = sex)) +
  geom_point() +
  geom_smooth(method = "lm", se = FALSE) +
  labs(title = "Average total UPDRS by age and sex", y = "Average total UPDRS")
ggsave("output/eda/aim2_age_sex.png", width = 6, height = 4)

ggplot(patients, aes(sex, total_mean)) +
  geom_boxplot() +
  geom_jitter(width = 0.1) +
  labs(title = "Average total UPDRS by sex", y = "Average total UPDRS")
ggsave("output/eda/aim2_sex_boxplot.png", width = 5, height = 4)

aim2_motor <- lmer(motor_UPDRS ~ age + sex + months + (1 | subject), data = pd)
aim2_total <- lmer(total_UPDRS ~ age + sex + months + (1 | subject), data = pd)
summary(aim2_motor)
summary(aim2_total)
