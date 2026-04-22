# Efficient Frontier Part II

import matplotlib
import numpy as np
import pandas as pd
from matplotlib import pyplot as plt

matplotlib.use("TkAgg") 
import noodling.edhec_risk_kit_108 as erk

ind = erk.get_ind_returns()
er = erk.annualize_rets(ind["1996":"2000"], 12)
cov = ind["1996":"2000"].cov()


l = ["Food", "Beer", "Smoke", "Coal"]

weights = np.repeat(1/4, 4)
print(erk.portfolio_return(weights, er[l]))
print(erk.portfolio_vol(weights, cov.loc[l,l]))


##### 2 Asset Frontier
l = ["Fin", "Beer"]
plot = erk.plot_ef2(25, er[l], cov.loc[l,l])
plot.show()