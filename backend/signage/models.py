from django.db import models

from competitions.models import new_object_id

CONTENT_ITEM_DEFAULTS = {'group': '0', 'disable': False, 'onlyOnce': False, 'repeat': 1}
CONTENT_ITEM_REQUIRED = ('duration', 'type', 'url')


def normalize_content_item(item):
    """Mirrors the defaults Mongoose applies to each embedded content
    sub-document (signageSchema.content.*)."""
    return {**CONTENT_ITEM_DEFAULTS, **item}


class Signage(models.Model):
    id = models.CharField(max_length=24, primary_key=True, default=new_object_id, editable=False)
    name = models.CharField(max_length=255, unique=True)
    content = models.JSONField(default=list, blank=True)
    news = models.JSONField(default=list, blank=True)

    class Meta:
        db_table = 'signage_settings'

    def legacy_dict(self):
        return {'_id': self.id, 'name': self.name, 'content': self.content, 'news': self.news, '__v': 0}
