# data/

Raw data from the UCI Machine Learning Repository. Do not edit these files; the scripts only read them.

| File | What it is | Used by |
|---|---|---|
| [@parkinsons+telemonitoring/](parkinsons+telemonitoring/) | Telemonitoring data: 5,875 home recordings, 42 people with PD, with UPDRS. See [@parkinsons+telemonitoring/README.md](parkinsons+telemonitoring/README.md). | all scripts |
| [@parkinsons.data](parkinsons.data) | Oxford PD vs healthy data (CSV): 195 clinic recordings, 32 subject IDs (24 PD, 8 healthy), no UPDRS. | [@../scripts/pd_figures.R](../scripts/pd_figures.R), [@../scripts/PD.PROJECT.Rmd](../scripts/PD.PROJECT.Rmd) |
| [@parkinsons.names](parkinsons.names) | UCI description of `parkinsons.data`. | reference only |

## Generated files (not in git)

Knitting [@../scripts/PD.PROJECT.Rmd](../scripts/PD.PROJECT.Rmd) writes these here. They are git-ignored; re-create them by knitting that file.

| File | Contents |
|---|---|
| `pad_clean.csv` | Cleaned telemonitoring data |
| `puc_clean.csv` | Cleaned PD vs healthy data |
| `pad_people.csv` | One row per telemonitoring person, with progression group |

[@../scripts/Aims_3_and_4.Rmd](../scripts/Aims_3_and_4.Rmd) needs `pad_clean.csv` and `puc_clean.csv`.

## Sources

- Telemonitoring: https://archive.ics.uci.edu/dataset/189/parkinsons+telemonitoring
- Parkinsons (Oxford): https://archive.ics.uci.edu/dataset/174/parkinsons

Column definitions: [@../CODEBOOK.md](../CODEBOOK.md).
