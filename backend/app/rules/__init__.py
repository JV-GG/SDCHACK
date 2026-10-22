from app.rules.mdec import MdecDigitalGrantRule
from app.rules.sme_corp import SmeCorpSagRule
from app.rules.matrade import MatradeMdgRule
from app.rules.hrd_corp import HrdCorpSblRule
from app.rules.mida import MidaDisfRule
from app.rules.miti import MitiIndustry4wrdRule
from app.rules.cradle import CradleCipSparkRule

ALL_GRANT_RULES = [
    MdecDigitalGrantRule(),
    SmeCorpSagRule(),
    MatradeMdgRule(),
    HrdCorpSblRule(),
    MidaDisfRule(),
    MitiIndustry4wrdRule(),
    CradleCipSparkRule(),
]
