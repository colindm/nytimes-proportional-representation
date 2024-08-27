library(redist)
library(dplyr)

data(texas)

# set a 0.1% population constraint
texas_map = redist_map(texas, existing_plan=cd_2010, pop_tol=0.001, total_pop = pop)
# simulate 500 plans using the SMC algorithm
texas_plans = redist_smc(texas_map, nsims=500)
#> SEQUENTIAL MONTE CARLO
#> Sampling 500 99-unit maps with 4 districts and population between 760,827 and 762,350.

library(ggplot2)
library(patchwork) # for plotting

redist.plot.plans(texas_plans, draws=c("cd_2010", "1", "2", "3"), shp=texas_map)
