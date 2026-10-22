from app.rules.mdec import MdecDigitalGrantRule
from app.rules.sme_corp import SmeCorpSagRule
from app.rules.matrade import MatradeMdgRule

ALL_GRANT_RULES = [
    MdecDigitalGrantRule(),
    SmeCorpSagRule(),
    MatradeMdgRule(),
]
