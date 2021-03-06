from django.conf.urls import patterns
from rest_framework.urlpatterns import format_suffix_patterns
from django.conf.urls import url

import scenarioEditor.views

urlpatterns = patterns('',
                       url(r'^$', scenarioEditor.views.user_home_view, name='index'),
                       url(r'^charView/', scenarioEditor.views.charView, name='charView'),
                       url(r'^convoView/', scenarioEditor.views.convoView, name='convoView'),
                       url(r'^assetView/', scenarioEditor.views.assetView, name='assetView'),
                       url(r'^roomView/', scenarioEditor.views.roomView, name='roomView'),
                       url(r'^itemView/', scenarioEditor.views.itemView, name='itemView'),
                       url(r'^manageView/', scenarioEditor.views.manageView, name='manageView'),
                       url(r'^dialogue/', scenarioEditor.views.dialogueView, name='dialogue_view'),
                       url(r'^login/', scenarioEditor.views.login_view, name='login_view'),
                       url(r'^logout/', scenarioEditor.views.logout_user_view, name='logout_user_view'),
                       url(r'^register/', scenarioEditor.views.register_view, name='register_view'),
                       url(r'^profile/scenarios', scenarioEditor.views.user_scenarios_view, name='profile_scenarios'),
                       url(r'^profile/', scenarioEditor.views.user_home_view, name='profile_home'),
                       url(r'^browse/scenarios', scenarioEditor.views.browse_scenarios_view, name='browse_scenarios'),
                       url(r'^create/', scenarioEditor.views.create_scenario_view, name='create_scenario'),
                       url(r'^edit/(?P<scenario_id>[0-9]+)/$', scenarioEditor.views.edit_scenario_view, name='edit_scenario'),
                       url(r'^upload_asset/', scenarioEditor.views.upload_asset, name='upload_asset'),  # File POST
                       
                       # Services
                       url(r'^service/component_set(?:/(?P<component_set_id>[0-9]+))?/$', scenarioEditor.views.component_set_service, name='component_set_service'),
                       url(r'^service/item(?:/(?P<item_id>[0-9]+))?/$', scenarioEditor.views.item_service, name='item_service'),
                       url(r'^service/trigger(?:/(?P<trigger_id>[0-9]+))?/$', scenarioEditor.views.trigger_service, name='trigger_service'),
                       url(r'^service/asset(?:/(?P<asset_id>[0-9]+))?/$', scenarioEditor.views.asset_service, name='asset_service'),
                       url(r'^service/update_scenario/(?P<scenario_id>[0-9]+)/$', scenarioEditor.views.update_scenario_service, name='update_scenario_service'),
                       url(r'^service/texture(?:/(?P<texture_id>[0-9]+))?/$', scenarioEditor.views.texture_service, name='update_texture_service'),
                       url(r'^service/proxy/', scenarioEditor.views.proxy_service, name='proxy_service'),
                       url(r'^service/gitlab_asset/', scenarioEditor.views.gitlab_asset, name='gitlab_asset_service'),
                       url(r'^service/post_process_component_set/', scenarioEditor.views.post_process_component_set_service, name='post_process_component_set_service'),
                       url(r'^service/dump_data/', scenarioEditor.views.dump_data_service, name='dump_data_service'),
                       url(r'^service/delete_scenario/(?P<scenario_id>[0-9]+)/$', scenarioEditor.views.delete_scenario_service, name='delete_scenario_service'),
                       url(r'^service/rename_scenario/(?P<scenario_id>[0-9]+)/$', scenarioEditor.views.rename_scenario_service, name='rename_scenario_service'),
                       )
