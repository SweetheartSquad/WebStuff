# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import models, migrations


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0007_componentset_description'),
    ]

    operations = [
        migrations.AddField(
            model_name='scenario',
            name='order',
            field=models.IntegerField(default=0),
        ),
        migrations.AddField(
            model_name='scenario',
            name='type',
            field=models.IntegerField(default=0),
        ),
    ]
