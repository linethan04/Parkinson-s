# output/aims_3_4/

Aims 3–4 tables and plots. Made by [@../../scripts/Aims_3_and_4.Rmd](../../scripts/Aims_3_and_4.Rmd).

Re-create:
1. Open [@../../Parkinson-s.Rproj](../../Parkinson-s.Rproj).
2. Knit [@../../scripts/PD.PROJECT.Rmd](../../scripts/PD.PROJECT.Rmd) (writes `data/pad_clean.csv` and `data/puc_clean.csv`).
3. Knit [@../../scripts/Aims_3_and_4.Rmd](../../scripts/Aims_3_and_4.Rmd) (a few minutes). All 7 files are overwritten.

| File | Contents |
|---|---|
| [@aim3_predictions.csv](aim3_predictions.csv) | Every held-out prediction |
| [@aim3_errors.csv](aim3_errors.csv) | MAE per outcome, test design and model |
| [@aim3_error.png](aim3_error.png) | Bar chart of the errors |
| [@aim3_predicted_actual.png](aim3_predicted_actual.png) | Predicted vs actual UPDRS, one dot per person |
| [@aim4_people.csv](aim4_people.csv) | One row of voice scores per person |
| [@aim4_tests.csv](aim4_tests.csv) | Medians, Wilcoxon tests, BH-adjusted p-values, rank-biserial effect sizes |
| [@aim4_boxplots.png](aim4_boxplots.png) | PD vs healthy boxplots |

Note: the committed files were made with R 4.6.1. Other R versions can change random forest MAEs in the second decimal (e.g. 7.31 vs 7.32); all other numbers match.
