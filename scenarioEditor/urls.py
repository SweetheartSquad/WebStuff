from django.conf.urls import patterns
from rest_framework.urlpatterns import format_suffix_patterns
import scenarioEditor.views

urlpatterns = patterns('',
                       (r'^$', scenarioEditor.views.index),
                       (r'^charView/', scenarioEditor.views.charView),
                       (r'^convoView/', scenarioEditor.views.convoView)
                       )