# Shared look for every figure in the project.
# Use it with: source("scripts/theme_pd.R")
library(ggplot2)

# Ink and chrome
ink       <- "#0b0b0b"
ink_soft  <- "#52514e"
ink_muted <- "#898781"
grid_col  <- "#e9e8e2"
axis_col  <- "#c3c2b7"

# Colours: each variable always gets the same colours in every figure
blue   <- "#2a78d6"
orange <- "#eb6834"
aqua   <- "#1baf7a"
red    <- "#e34948"
grey   <- "#a8a7a0"

col_sex         <- c(Male = blue, Female = orange)
col_group       <- c(Healthy = aqua, PD = orange)
col_progression <- c(Worsened = red, Stable = grey, Improved = blue)
col_part        <- c("Between people" = blue, "Within a person" = orange)
col_scheme      <- c("Random split" = blue, "Leave one person out" = orange)
col_dataset     <- c("Home PD (telemonitoring)" = blue,
                     "Clinic PD (Oxford)"       = orange,
                     "Healthy (Oxford)"         = aqua)

theme_pd <- function(base_size = 11) {
  theme_minimal(base_size = base_size) +
    theme(
      plot.title.position   = "plot",
      plot.caption.position = "plot",
      plot.title    = element_text(face = "bold", size = rel(1.3), colour = ink,
                                   margin = margin(b = 4)),
      plot.subtitle = element_text(colour = ink_soft, lineheight = 1.15,
                                   margin = margin(b = 12)),
      plot.caption  = element_text(colour = ink_muted, size = rel(0.8), hjust = 0,
                                   lineheight = 1.15, margin = margin(t = 12)),
      plot.tag      = element_text(face = "bold", size = rel(1.2), colour = ink),
      axis.title    = element_text(colour = ink_soft, size = rel(0.9)),
      axis.title.x  = element_text(margin = margin(t = 8)),
      axis.title.y  = element_text(margin = margin(r = 8)),
      axis.text     = element_text(colour = ink_soft, size = rel(0.85)),
      axis.line.x   = element_line(colour = axis_col, linewidth = 0.4),
      panel.grid.major = element_line(colour = grid_col, linewidth = 0.35),
      panel.grid.minor = element_blank(),
      panel.spacing    = unit(1.2, "lines"),
      strip.text    = element_text(face = "bold", colour = ink, hjust = 0,
                                   size = rel(0.95), margin = margin(b = 6)),
      legend.position      = "top",
      legend.justification = "left",
      legend.title  = element_text(colour = ink_soft, size = rel(0.9)),
      legend.text   = element_text(colour = ink_soft, size = rel(0.9)),
      legend.margin = margin(0, 0, 0, 0),
      legend.key.size = unit(0.9, "lines"),
      plot.background = element_rect(fill = "white", colour = NA),
      plot.margin   = margin(16, 18, 12, 16)
    )
}

theme_set(theme_pd())
update_geom_defaults("text", list(colour = ink_soft, size = 3.2))

# Saves a 300 dpi PNG (print quality). ragg gives sharp text and handles symbols like ρ.
save_fig <- function(plot, name, width = 8, height = 5) {
  ggsave(file.path("output/figures", paste0(name, ".png")), plot,
         width = width, height = height, dpi = 300, device = ragg::agg_png)
}
