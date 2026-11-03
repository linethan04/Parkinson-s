# Codebook — Parkinson's Telemonitoring Dataset

**Source:** UCI Machine Learning Repository, *Parkinson's Telemonitoring* (Tsanas, Little, McSharry & Ramig, 2009).
**File:** [`data/parkinsons+telemonitoring/parkinsons_updrs.data`](data/parkinsons+telemonitoring/parkinsons_updrs.data) (CSV, comma-separated, header row)
**Size:** 5,875 rows × 22 columns, no missing values

**Unit of observation:** one row is one sustained-vowel ("ahh") voice recording made at home. There are 42 patients with early-stage Parkinson's disease and 101–168 recordings each, collected over a six-month trial.

> **Important:** age and sex never change within a patient, and UPDRS was measured by a clinician only at baseline, about 3 months and about 6 months. The UPDRS values for recordings between those visits are **linearly interpolated**, so recordings from the same patient are not independent.

---

## Identifiers and demographics

| Column (raw) | Name in `ethan_sandbox.R` | Type | Range | Description |
|---|---|---|---|---|
| `subject#` | `subject` | integer → factor | 1–42 | Unique patient ID. |
| `age` | `age` | integer (years) | 36–85 | Patient age at enrolment. Constant within patient. |
| `sex` | `sex` | integer → factor | 0, 1 | `0` = male, `1` = female (recoded to `Male`/`Female`). 28 male, 14 female patients. |
| `test_time` | `test_time` | numeric (days) | −4.3 to 215.5 | Days since recruitment; the integer part is the day count. 12 rows are slightly negative (recorded just before the recruitment date). |
| — | `months` | numeric (months) | ≈ −0.1 to 7.2 | Derived: `test_time / 30`. |

## Outcomes (symptom severity)

| Column (raw) | Name in script | Type | Range | Description |
|---|---|---|---|---|
| `motor_UPDRS` | `motor_UPDRS` | numeric | 5.0–39.5 | Clinician-rated motor section (Part III) of the Unified Parkinson's Disease Rating Scale, linearly interpolated between visits. Scale range 0–108; higher means worse motor symptoms. |
| `total_UPDRS` | `total_UPDRS` | numeric | 7.0–55.0 | Clinician-rated total UPDRS (Parts I–III: mentation/mood, daily living, motor), linearly interpolated between visits. Scale range 0–176; higher means more severe disease. |

## Voice measures: jitter (cycle-to-cycle variation in pitch)

Jitter captures how unsteady the vocal folds' vibration frequency is from one cycle to the next. Higher values mean a less stable voice.

| Column (raw) | Name in script | Range | Description |
|---|---|---|---|
| `Jitter(%)` | `jitter_pct` | 0.00083–0.100 | Mean absolute difference between consecutive pitch periods, relative to the mean period. |
| `Jitter(Abs)` | `jitter_abs` | 2.3e-06–4.5e-04 | Mean absolute difference between consecutive pitch periods, in seconds. |
| `Jitter:RAP` | `jitter_rap` | 0.00033–0.058 | Relative Average Perturbation: each period compared with the average of itself and its 2 neighbours (3-period window). |
| `Jitter:PPQ5` | `jitter_ppq5` | 0.00043–0.070 | 5-point Period Perturbation Quotient: each period compared with a 5-period local average. |
| `Jitter:DDP` | `jitter_ddp` | 0.00098–0.173 | Average absolute difference of differences between consecutive periods. **Exactly 3 × `Jitter:RAP`** (redundant). |

## Voice measures: shimmer (cycle-to-cycle variation in loudness)

Shimmer captures how unsteady the amplitude (loudness) is from one vocal cycle to the next. Higher values mean a less stable voice.

| Column (raw) | Name in script | Range | Description |
|---|---|---|---|
| `Shimmer` | `shimmer` | 0.0031–0.269 | Mean absolute difference in amplitude between consecutive cycles, relative to mean amplitude. |
| `Shimmer(dB)` | `shimmer_db` | 0.026–2.107 | The same idea expressed in decibels. |
| `Shimmer:APQ3` | `shimmer_apq3` | 0.0016–0.163 | 3-point Amplitude Perturbation Quotient (3-cycle local average). |
| `Shimmer:APQ5` | `shimmer_apq5` | 0.0019–0.167 | 5-point Amplitude Perturbation Quotient. |
| `Shimmer:APQ11` | `shimmer_apq11` | 0.0025–0.275 | 11-point Amplitude Perturbation Quotient. |
| `Shimmer:DDA` | `shimmer_dda` | 0.0048–0.488 | Average absolute difference between consecutive amplitude differences. **Exactly 3 × `Shimmer:APQ3`** (redundant). |

## Other voice measures

| Column (raw) | Name in script | Range | Description |
|---|---|---|---|
| `NHR` | `NHR` | 0.0003–0.748 | Noise-to-Harmonics Ratio: noise energy relative to tonal (harmonic) energy. Higher means a breathier, noisier voice. |
| `HNR` | `HNR` | 1.7–37.9 (dB) | Harmonics-to-Noise Ratio: the inverse idea of NHR. **Lower** means a noisier voice. |
| `RPDE` | `RPDE` | 0.15–0.97 | Recurrence Period Density Entropy: a nonlinear measure of how predictable the voice signal's repeating pattern is. Higher means less periodic. |
| `DFA` | `DFA` | 0.51–0.87 | Detrended Fluctuation Analysis: a fractal scaling exponent describing turbulent noise in the voice signal. |
| `PPE` | `PPE` | 0.022–0.73 | Pitch Period Entropy: a nonlinear measure of pitch irregularity that is robust to normal differences in speaking pitch. Higher means more impaired pitch control. |

---

## Notes for analysis

- **Skew:** jitter, shimmer and NHR are strongly right-skewed. `ethan_sandbox.R` overwrites the 11 jitter and shimmer columns with `scale(log(x))` (log-transformed, then standardised to mean 0 and SD 1), so model effects read as "UPDRS points per 1 SD of log(measure)".
- **Collinearity:** within each family the measures are highly correlated (ρ > 0.9). Treat them as alternative versions of one signal rather than independent predictors.
- **Effective sample size:** for patient-level questions (age, sex), n = 42, not 5,875.
- **Further detail:** see [`data/parkinsons+telemonitoring/parkinsons_updrs.names`](data/parkinsons+telemonitoring/parkinsons_updrs.names) and Little et al. (2009), *IEEE Trans. Biomed. Eng.* 56(4):1015–1022.
