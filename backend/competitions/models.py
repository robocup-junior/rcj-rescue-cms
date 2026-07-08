import secrets

from django.db import models


def new_object_id():
    """24 hex chars, shaped like a Mongo ObjectId so any still-Mongo-side
    code that treats this id as a Mongo ObjectId (e.g. Run.round refs on
    the not-yet-migrated lineRuns/mazeRuns collections) keeps working."""
    return secrets.token_hex(12)


class Round(models.Model):
    id = models.CharField(max_length=24, primary_key=True, default=new_object_id, editable=False)
    competition_id = models.CharField(max_length=24, db_index=True)
    name = models.CharField(max_length=255)

    class Meta:
        db_table = 'competition_rounds'
        constraints = [
            models.UniqueConstraint(fields=['competition_id', 'name'], name='uniq_round_competition_name'),
        ]

    def legacy_dict(self):
        return {'_id': self.id, 'competition': self.competition_id, 'name': self.name, '__v': 0}


class Field(models.Model):
    id = models.CharField(max_length=24, primary_key=True, default=new_object_id, editable=False)
    competition_id = models.CharField(max_length=24, db_index=True)
    name = models.CharField(max_length=255)

    class Meta:
        db_table = 'competition_fields'
        constraints = [
            models.UniqueConstraint(fields=['competition_id', 'name'], name='uniq_field_competition_name'),
        ]

    def legacy_dict(self):
        return {'_id': self.id, 'competition': self.competition_id, 'name': self.name, '__v': 0}
