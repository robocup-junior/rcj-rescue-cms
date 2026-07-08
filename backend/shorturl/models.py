from django.db import models

from competitions.models import new_object_id


class ShortUrl(models.Model):
    id = models.CharField(max_length=24, primary_key=True, default=new_object_id, editable=False)
    name = models.CharField(max_length=255)
    # Express enforces shorted-slug uniqueness only across newly-created rows
    # (its pre-save hook skips the check on update -- see shorturl/views.py);
    # DB-level uniqueness is still safe to add since updates never change
    # `shorted` for a different row than the one being looked up by name.
    shorted = models.CharField(max_length=255, unique=True)
    transfer = models.CharField(max_length=2048)

    class Meta:
        db_table = 'short_urls'

    def legacy_dict(self):
        return {'_id': self.id, 'name': self.name, 'shorted': self.shorted, 'transfer': self.transfer, '__v': 0}
