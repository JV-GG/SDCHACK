from abc import ABC, abstractmethod
from app.models.schemas import SMEProfile, Invoice, GrantEvaluation

class BaseGrantRule(ABC):
    grant_id: str
    grant_name: str
    agency: str
    matching_percentage: int

    @abstractmethod
    def evaluate(self, company: SMEProfile, invoice: Invoice) -> GrantEvaluation:
        """Evaluate SME eligibility against strict deterministic grant rules."""
        pass
