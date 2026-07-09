import secrets

from django.conf import settings
from django.db import models

SUM_OF_BEST_N_GAMES = 'SUM_OF_BEST_N_GAMES'
MEAN_OF_NORMALIZED_BEST_N_GAMES = 'MEAN_OF_NORMALIZED_BEST_N_GAMES'
MEAN_OF_NORMALIZED_BEST_N_GAMES_NORMALIZED_DOCUMENT = 'MEAN_OF_NORMALIZED_BEST_N_GAMES_NORMALIZED_DOCUMENT'
GAMES_DOCUMENT_CHALLENGE = 'GAMES_DOCUMENT_CHALLENGE'
RANKING_MODES = (
    SUM_OF_BEST_N_GAMES,
    MEAN_OF_NORMALIZED_BEST_N_GAMES,
    MEAN_OF_NORMALIZED_BEST_N_GAMES_NORMALIZED_DOCUMENT,
    GAMES_DOCUMENT_CHALLENGE,
)

_BASE32_DIGITS = '0123456789abcdefghijklmnopqrstuv'


def new_object_id():
    """24 hex chars, shaped like a Mongo ObjectId so any still-Mongo-side
    code that treats this id as a Mongo ObjectId (e.g. Run.round refs on
    the not-yet-migrated lineRuns/mazeRuns collections) keeps working."""
    return secrets.token_hex(12)


def new_public_token():
    """Mirrors Competition.publicToken's default in models/competition.js:
    crypto.randomBytes(16).reduce((p, i) => p + (i % 32).toString(32), '').
    Doesn't need to be byte-identical, just similarly opaque/random."""
    return ''.join(_BASE32_DIGITS[b % 32] for b in secrets.token_bytes(16))


class Competition(models.Model):
    id = models.CharField(max_length=24, primary_key=True, default=new_object_id, editable=False)
    name = models.CharField(max_length=255, unique=True)
    logo = models.CharField(max_length=512, default='/images/noLogo.png')
    bk_color = models.CharField(max_length=32, default='#fff')
    color = models.CharField(max_length=32, default='#000')
    message = models.TextField(default='', blank=True)
    description = models.TextField(default='', blank=True)
    preparation = models.BooleanField(default=True)
    # Mongoose has `select: false` on publicToken -- excluded from the
    # normal list/get JSON responses, not modeled as a legacy_dict() field.
    public_token = models.CharField(max_length=32, default=new_public_token, editable=False)
    documents_enable = models.BooleanField(default=False)
    documents_deadline = models.BigIntegerField(default=0)
    # The much larger nested per-league document form config
    # (documents.leagues[].{languages,notifications,blocks[].questions[]...})
    # is Phase 3 (document form editor) scope -- not modeled here yet.

    class Meta:
        db_table = 'competitions'

    def legacy_dict(self):
        leagues = []
        for entry in self.leagues.all().order_by('league'):
            league_info = next((l for l in settings.LEAGUES_JSON if l['id'] == entry.league), None)
            leagues.append({
                'league': entry.league,
                'num': entry.num,
                'mode': entry.mode,
                'disclose': entry.disclose,
                'rule': entry.rule,
                'name': league_info['name'] if league_info else None,
                'type': league_info['type'] if league_info else None,
            })
        return {
            '_id': self.id,
            'name': self.name,
            'logo': self.logo or '/images/noLogo.png',
            'bkColor': self.bk_color or '#fff',
            'color': self.color or '#000',
            'message': self.message or '',
            'description': self.description or '',
            'preparation': self.preparation,
            'leagues': leagues,
            'documents': {'enable': self.documents_enable, 'deadline': self.documents_deadline},
            '__v': 0,
        }

    def legacy_list_dict(self):
        """GET /api/competitions (list) applies slightly different fallback
        defaults than GET /api/competitions/:id and omits the per-league
        name/type enrichment -- kept as two methods rather than one to
        mirror that faithfully instead of guessing they should match."""
        return {
            '_id': self.id,
            'name': self.name,
            'logo': self.logo or '/images/NoImage.png',
            'bkColor': self.bk_color or 'ffffff',
            'color': self.color or '000000',
            'message': self.message or '',
            'description': self.description or '',
            'preparation': self.preparation,
            'documents': {'enable': self.documents_enable, 'deadline': self.documents_deadline},
            '__v': 0,
        }


class CompetitionLeague(models.Model):
    competition = models.ForeignKey(Competition, related_name='leagues', on_delete=models.CASCADE)
    league = models.CharField(max_length=64)
    num = models.IntegerField(default=20)
    mode = models.CharField(max_length=64, choices=[(m, m) for m in RANKING_MODES], default=RANKING_MODES[0])
    disclose = models.BooleanField(default=False)
    rule = models.CharField(max_length=32, default='')

    class Meta:
        db_table = 'competition_leagues'
        constraints = [
            models.UniqueConstraint(fields=['competition', 'league'], name='uniq_competition_league'),
        ]


class Round(models.Model):
    id = models.CharField(max_length=24, primary_key=True, default=new_object_id, editable=False)
    competition = models.ForeignKey(Competition, on_delete=models.CASCADE, related_name='rounds')
    name = models.CharField(max_length=255)

    class Meta:
        db_table = 'competition_rounds'
        constraints = [
            models.UniqueConstraint(fields=['competition', 'name'], name='uniq_round_competition_name'),
        ]

    def legacy_dict(self):
        return {'_id': self.id, 'competition': self.competition_id, 'name': self.name, '__v': 0}


class Field(models.Model):
    id = models.CharField(max_length=24, primary_key=True, default=new_object_id, editable=False)
    competition = models.ForeignKey(Competition, on_delete=models.CASCADE, related_name='fields')
    name = models.CharField(max_length=255)

    class Meta:
        db_table = 'competition_fields'
        constraints = [
            models.UniqueConstraint(fields=['competition', 'name'], name='uniq_field_competition_name'),
        ]

    def legacy_dict(self):
        return {'_id': self.id, 'competition': self.competition_id, 'name': self.name, '__v': 0}
