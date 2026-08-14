# Efficient Frontier Part II

import matplotlib
import numpy as np

matplotlib.use('TkAgg')
import noodling.edhec_risk_kit_108 as erk

ind = erk.get_ind_returns()
er = erk.annualize_rets(ind['1996':'2000'], 12)
cov = ind['1996':'2000'].cov()


industries = ['Food', 'Beer', 'Smoke', 'Coal']

weights = np.repeat(1 / 4, 4)
print(erk.portfolio_return(weights, er[industries]))
print(erk.portfolio_vol(weights, cov.loc[industries, industries]))


##### 2 Asset Frontier
industries = ['Fin', 'Beer']
plot = erk.plot_ef2(25, er[industries], cov.loc[industries, industries])
plot.show()
