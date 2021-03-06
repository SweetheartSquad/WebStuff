# coding=utf8

from django.contrib.auth.decorators import login_required
from django.core.paginator import Paginator
from django.core.urlresolvers import reverse
from django.db.models import Q
from django.http import HttpResponse, HttpResponseBadRequest, HttpResponseRedirect
from django.shortcuts import render, redirect, render_to_response
from django.contrib.auth import authenticate, login, logout
from django.template import Template, Context, RequestContext
from django.contrib.auth.models import User
from django.template.loader import get_template
from django.views.decorators.csrf import csrf_exempt
from api.models import PDUser, Scenario, UploadFile, Texture, ComponentSet, Asset, ItemDefinition, Tag, \
    CharacterComponent, Trigger, TriggerArgument
from scenarioEditor.forms import AssetFileForm, AssetForm, ComponentSetForm, ItemForm, TriggerArgumentForm, TriggerForm
import gitlab_utility
import uuid
from django.core import serializers
import json
import urllib2

APPLICATION_JSON = 'application/json'


@login_required(login_url='/scenario/login/')
def index(request):
    return render_to_response('scenarioEditor/index.html/', RequestContext(request, {}))


@login_required(login_url='/scenario/login/')
def charView(request):
    return render(request, 'scenarioEditor/charView/charView.html/', {})


@login_required(login_url='/scenario/login/')
def convoView(request):
    return render(request, 'scenarioEditor/convoView/convoView.html/', {})


@login_required(login_url='/scenario/login/')
def assetView(request):
    return render(request, 'scenarioEditor/assetView/assetView.html/', {})


@login_required(login_url='/scenario/login/')
def roomView(request):
    return render(request, 'scenarioEditor/roomView/roomView.html/', {})


@login_required(login_url='/scenario/login/')
def itemView(request):
    return render(request, 'scenarioEditor/itemView/itemView.html/', {})


@login_required(login_url='/scenario/login/')
def manageView(request):
    return render(request, 'scenarioEditor/manageView/manageView.html/', {})


@login_required(login_url='/scenario/dialogue/')
def dialogueView(request):
    return render(request, 'scenarioEditor/convoView/dialogue.html/', {})


@login_required(login_url='/scenario/login/')
def user_scenarios_view(request):
    pd_user = PDUser.objects.get(user=request.user)
    scenarios = list(Scenario.objects.filter(owner=pd_user))
    return render(request, 'scenarioEditor/profile/scenarios.html/', {'scenarios': scenarios})


@login_required(login_url='/scenario/login/')
def user_home_view(request):
    return render(request, 'scenarioEditor/profile/home.html/', {})


def dump_component_textures(request):
    comp_textures = Texture.objects.filter(type=Texture.CHARACTER_COMPONENT).all()
    assets = {'assets': []}

    for tex in comp_textures:
        d = tex.asDict()
        d.pop("imageUrl", None)
        d['type'] = 'texture'
        assets['assets'].append(d)

    gitlab_utility.update_file(gitlab_utility.get_project_name(),
                               PDUser.branch_for_user(user=request.user),
                               "component-textures.json",
                               json.dumps(assets, sort_keys=True, indent=4, separators=(',', ': ')),
                               "text")


def dump_item_textures(request):
    item_textures = Texture.objects.filter(type=Texture.ITEM).all()

    assets = {'assets': []}

    for tex in item_textures:
        d = tex.asDict()
        d.pop("imageUrl", None)
        d['type'] = 'texture'
        assets['assets'].append(d)

    gitlab_utility.update_file(gitlab_utility.get_project_name(),
                               PDUser.branch_for_user(user=request.user),
                               "item-textures.json",
                               json.dumps(assets, sort_keys=True, indent=4, separators=(',', ': ')),
                               "text")


def dump_component_definitions(request):
    components = {'components': []}
    sets = ComponentSet.objects.all()

    for set in sets:
        components['components'].append({"src": set.jsonRepresentation, "type": set.setType, "random": set.random})

    gitlab_utility.update_file(gitlab_utility.get_project_name(),
                               PDUser.branch_for_user(user=request.user),
                               "component-definitions.json",
                               json.dumps(components, sort_keys=True, indent=4, separators=(',', ': ')),
                               "text")


def dump_scenarios(request):
    scenarios = []
    scenario_objs = Scenario.objects.all()

    for obj in scenario_objs:

        scenarios.append({
            'src': obj.jsonUrl,
            'order': obj.order,
            'type': obj.type
        })

    gitlab_utility.update_file(gitlab_utility.get_project_name(),
                           PDUser.branch_for_user(user=request.user),
                           "scenarios.json",
                           json.dumps(scenarios, sort_keys=True, indent=4, separators=(',', ': ')),
                           "text")


def browse_scenarios_view(request):
    get_params = request.GET
    simple_query_items = dict()
    complex_query_items = []

    # id overrides anything
    if 'id' in get_params:
        simple_query_items['id'] = get_params['id']
    else:
        if 'name' in get_params:
            simple_query_items['name__startswith'] = get_params['name']
        if 'rating' in get_params:
            complex_query_items.append(Q(rating__gte=get_params['rating']) | Q(rating_count=0))

    scenarios = Scenario.objects.filter(*complex_query_items, **simple_query_items)

    if 'sort_by' in get_params and (get_params['sort_by'] == 'id' or 'rating' or 'name'):
        sort_order = ''
        if ('sort_order' in get_params) and get_params['sort_order'] == 'desc':
            sort_order = '-'
        scenarios = scenarios.order_by(sort_order + str(get_params['sort_by']))

    return render(request, 'scenarioEditor/profile/scenarios.html/', {'scenarios': scenarios})


def login_view(request):
    if 'username' in request.POST and 'password' in request.POST:
        username = request.POST['username']
        password = request.POST['password']
        user = authenticate(username=username, password=password)

        if user is not None:
            if user.is_active:
                login(request, user)
                pd_user = PDUser.objects.get(user=user.id)
                pd_user.gitlab_branch = username
                pd_user.save()
                gitlab_utility.create_branch_if_not_exists(username)
                return redirect('index')
            else:
                # Return a 'disabled account' error message
                return render(request, 'scenarioEditor/login.html/', {'login_error': 2})
        else:
            # Return an 'invalid login' error message.
            return render(request, 'scenarioEditor/login.html/', {'login_error': 1})
    else:
        return render(request, 'scenarioEditor/login.html/', {'login_error': 0})


def register_view(request):
    if 'username' in request.POST and 'password' in request.POST:
        username = request.POST['username']
        password = request.POST['password']
        user = User.objects.create_user(username=username, password=password)
        pd_user = PDUser(user=user)
        pd_user.gitlab_branch = username
        pd_user.save()
        gitlab_utility.create_branch_if_not_exists(username)
        user_auth = authenticate(username=username, password=password)
        login(request, user_auth)
        return redirect('index')
    else:
        return render(request, 'scenarioEditor/register.html/', {})


@csrf_exempt
@login_required(login_url='/scenario/login/')
def update_scenario_service(request, scenario_id):
    if request.method == 'POST':
        if scenario_id is not None:
            scenario = Scenario.objects.get(id=scenario_id)
            pd_user = PDUser.objects.get(user=request.user)
            if scenario.owner.id == pd_user.id:
                scenario.script = request.body
                scenario.script = scenario.script.replace('…', "...")
                scenario.script = scenario.script.replace('’', "'")
                scenario.script = scenario.script.replace('‘', "'")
                scenario.script = scenario.script.replace('”', '\\"')
                scenario.script = scenario.script.replace('“', '\\"')
                scen_json = json.loads(scenario.script)
                scenario.order = scen_json['order']
                scenario.type = scen_json['type']
                file_name = scenario.jsonUrl
                gitlab_result = gitlab_utility.update_file(gitlab_utility.get_project_name(), PDUser.branch_for_user(user=request.user),
                                           file_name, scenario.script, "text")
                if gitlab_result is False:
                    return HttpResponse("Gitlab save failed", status = 500)
                
                scenario.save()
                
                return HttpResponse(request.body)
            else:
                return HttpResponse("Unauthorized", status=401)
        else:
            return HttpResponse("Bad Request", status=400)
    else:
        return HttpResponse("Invalid Method", status=405)


@csrf_exempt
@login_required(login_url='/scenario/login/')
def delete_scenario_service(request, scenario_id):
    if request.method == 'GET':
        if scenario_id is not None:
            scenario = Scenario.objects.get(id=scenario_id)
            pd_user = PDUser.objects.get(user=request.user)
            if scenario.owner.id == pd_user.id:
                file_name = scenario.jsonUrl
                gitlab_utility.delete_file(file_name, PDUser.branch_for_user(user=request.user))
                scenario.delete()
                dump_scenarios(request)
                return redirect('index')
            else:
                return HttpResponse("Unauthorized", status=401)
        else:
            return HttpResponse("Bad Request", status=400)
    else:
        return HttpResponse("Invalid Method", status=405)


@csrf_exempt
@login_required(login_url='/scenario/login/')
def rename_scenario_service(request, scenario_id):
    if request.method == 'POST':
        payload = json.loads(request.body)
        if scenario_id is not None and 'name' in payload:
            scenario = Scenario.objects.get(id=scenario_id)
            pd_user = PDUser.objects.get(user=request.user)
            if scenario.owner.id == pd_user.id:
                old_file_name = scenario.jsonUrl
                scenario.name = payload['name']
                scenario.jsonUrl = "scenarios/" + scenario.name.replace(" ", "_") + ".json"
                gitlab_utility.delete_file(old_file_name, PDUser.branch_for_user(user=request.user))
                gitlab_utility.create_file(gitlab_utility.get_project_name(), PDUser.branch_for_user(user=request.user),
                                       scenario.jsonUrl, scenario.script, "text")
                scenario.save()
                dump_scenarios(request)
                return HttpResponse()
            else:
                return HttpResponse("Unauthorized", status=401)
        else:
            return HttpResponse("Bad Request", status=400)
    else:
        return HttpResponse("Invalid Method", status=405)


@login_required(login_url='/scenario/login/')
def create_scenario_view(request):
    if request.method == 'GET':
        return render(request, 'scenarioEditor/create/create_scenario.html/', {})
    elif request.method == 'POST':
        if 'scenario_name' in request.POST:
            pd_user = PDUser.objects.get(user=request.user)
            scenario = Scenario(name=str(request.POST['scenario_name']), owner=pd_user)
            file_name = "scenarios/" + scenario.name.replace(" ", "_") + ".json"
            scenario.script = '{"assets":[]}'
            scenario.jsonUrl = file_name
            gitlab_utility.create_file(gitlab_utility.get_project_name(), PDUser.branch_for_user(user=request.user),
                                       file_name, scenario.script, "text")
            scenario.save()
            dump_scenarios(request)
            return redirect(edit_scenario_view, scenario.id)
    else:
        # Return invalid method response
        return HttpResponse("Invalid Method", status=405)


@login_required(login_url='/scenario/login/')
def edit_scenario_view(request, scenario_id):
    if request.method == 'GET':
        scenario = Scenario.objects.get(id=scenario_id)
        if scenario is not None:
            if scenario.owner.id != PDUser.objects.get(user=request.user).id:
                return HttpResponse("Unauthorized")
            scenario.jsonUrl = gitlab_utility.get_project_url() + "/raw/" + PDUser.branch_for_user(
                request.user) + "/" + scenario.jsonUrl
            scenario.script = urllib2.urlopen(scenario.jsonUrl).read()
            return render(request, 'scenarioEditor/index.html/', {'scenario': scenario})
    else:
        # Return invalid method response
        return HttpResponse("Invalid Method", status=405)


@login_required(login_url='/scenario/login/')
def component_set_service(request, component_set_id=None):
    if request.method == 'GET':
        try:
            if component_set_id is not None:
                obj = ComponentSet.objects.get(id=component_set_id)
                if obj is not None:
                    data = json.dumps(obj.asDict(), sort_keys=True, indent=4, separators=(',', ': '))
                    return HttpResponse(data, content_type='application/json')
            else:
                get_params = request.GET
                simple_query_items = dict()
                complex_query_items = []

                if 'setType' in get_params:
                    simple_query_items['setType__istartswith'] = get_params['setType']

                if 'name' in get_params:
                    simple_query_items['name__istartswith'] = get_params['name']

                sets = ComponentSet.objects.filter(*complex_query_items, **simple_query_items)

                tagResult = None

                # @TODO This logic should be achievable using a single query
                if 'tags' in get_params:
                    tags = get_params['tags'].split(",")
                    tagResult = Tag.objects.filter(value__in=tags, owner__in=sets)

                filteredSets = []

                if tagResult != None and 'tags' in get_params:
                    for tag in tagResult:
                        for set in sets.all():
                            if tag.owner.id == set.id and set not in filteredSets:
                                filteredSets.append(set)
                else:
                    filteredSets = sets.all()

                paginator = Paginator(filteredSets, 10)

                if 'page' in request.GET:
                    filteredSets = paginator.page(request.GET['page']).object_list

                if len(filteredSets) > 0:
                    cj = []
                    for c in filteredSets:
                        cj.append(c.asDict())
                    data = json.dumps(cj, sort_keys=True, indent=4, separators=(',', ': '))
                    return HttpResponse(data, content_type='application/json')
                else:
                    return HttpResponse("No objects found for query", status=404)
        except:
            return HttpResponse("Object could not be found", status=404)

    elif request.method == 'POST':
        try:
            in_data = json.loads(request.body)
            comp_set_form = ComponentSetForm(data=in_data)
            if comp_set_form.is_valid():
                
                if component_set_id is None:
                    same_name_obj_count = ComponentSet.objects.filter(name=comp_set_form.cleaned_data["name"], setType=comp_set_form.cleaned_data["setType"]).count()
                
                    if(same_name_obj_count != 0):
                        return HttpResponse("Component set with name " + comp_set_form.cleaned_data["name"] + " already exists", status=400)
                    
                    comp_set = ComponentSet()
                else:
                    try:
                        comp_set = ComponentSet.objects.get(id=long(component_set_id))
                    except:
                        return HttpResponse("Could not find component set for id " + str(component_set_id), status=404)

                comp_set.name = comp_set_form.cleaned_data["name"].replace(" ", "_")

                comp_set.description = comp_set_form.cleaned_data["description"]
                comp_set.random = comp_set_form.cleaned_data["random"]

                if component_set_id is None:
                    comp_set.setType = comp_set_form.cleaned_data["setType"]

                    joints_file_name = "components/definitions/" + comp_set_form.cleaned_data["name"].replace(" ", "_") + "_" + comp_set_form.cleaned_data["setType"] + ".json"

                    json_obj = json.loads(comp_set_form.cleaned_data["joints"])

                    gitlab_utility.create_file(gitlab_utility.get_project_name(),
                                               PDUser.branch_for_user(user=request.user),
                                               joints_file_name,
                                               json.dumps(json_obj, sort_keys=True, indent=4, separators=(',', ': ')),
                                               "text")

                    comp_set.jsonRepresentation = joints_file_name

                comp_set.save()

                tags = comp_set.getTags()

                ex_tag_vals = []

                for tag in tags:
                    ex_tag_vals.append(tag.value)

                for t in comp_set_form.cleaned_data["tags"]:
                    if t not in ex_tag_vals:
                        tag = Tag(value=t)
                        tag.owner = comp_set
                        tag.save()

                dump_component_definitions(request)

                return HttpResponse('{"status":"created", "id":' + str(comp_set.id) + '}',
                                    content_type='application/json')
            else:
                return HttpResponse("Invalid request data - " + comp_set_form.errors.as_json(), status=400)
        except:
            return HttpResponse("Bad post data - " + request.body, status=400)
    elif request.method == 'DELETE':
        if component_set_id is not None:
            set = ComponentSet.objects.get(id=component_set_id)
            components = set.get_components()

            branch = PDUser.branch_for_user(user=request.user)

            for comp in components:
                url = comp.texture.imageUrl
                gitlab_utility.delete_file(url, branch)
                comp.texture.delete()
                comp.delete()

            gitlab_utility.delete_file(set.jsonRepresentation, branch)
            set.delete()
            dump_component_definitions(request)
            dump_component_textures(request)
            return HttpResponse('Success')
    else:
        return HttpResponse("Invalid Method", status=405)


@login_required(login_url='/scenario/login/')
def item_service(request, item_id=None):
    if request.method == 'GET':
        if item_id is not None:
            try:
                obj = ItemDefinition.objects.get(id=item_id)
                if obj is not None:
                    data = json.dumps(obj.asDict(), sort_keys=True, indent=4, separators=(',', ': '))
                    return HttpResponse(data, content_type='application/json')
            except:
                return HttpResponse("Object could not be found", status=404)
        else:
            get_params = request.GET
            simple_query_items = dict()
            complex_query_items = []

            if 'name' in get_params:
                simple_query_items['name__istartswith'] = get_params['name']

            items = ItemDefinition.objects.filter(*complex_query_items, **simple_query_items)

            tagResult = None

            # @TODO This logic should be achievable using a single query
            if 'tags' in get_params:
                tags = get_params['tags'].split(",")
                tagResult = Tag.objects.filter(value__in=tags, owner__in=items)

            filtered_items = []

            if tagResult != None and 'tags' in get_params:
                for tag in tagResult:
                    for item in items.all():
                        if tag.owner.id == item.id and item not in filtered_items:
                            filtered_items.append(item)
            else:
                filtered_items = items.all()

            paginator = Paginator(filtered_items, 3)

            if 'page' in request.GET:
                filtered_items = paginator.page(request.GET['page']).object_list

            if len(filtered_items) > 0:
                cj = []
                for c in filtered_items:
                    cj.append(c.asDict())
                data = json.dumps(cj, sort_keys=True, indent=4, separators=(',', ': '))
                return HttpResponse(data, content_type='application/json')
            else:
                return HttpResponse("No objects found for query", status=404)
    elif request.method == 'POST':
        try:
            in_data = json.loads(request.body)
            item_form = ItemForm(data=in_data)
            if item_form.is_valid():
                if item_id is None:
                    same_name_obj_count = ItemDefinition.objects.filter(name=item_form.cleaned_data["name"]).count()
                
                    if(same_name_obj_count != 0):
                        return HttpResponse("Item with name " + item_form.cleaned_data["name"] + " already exists", status=400)
                    
                    item = ItemDefinition()
                else:
                    try:
                        item = ItemDefinition.objects.get(id=long(item_id))
                    except:
                        return HttpResponse('Item for id ' + item_id + ' could not be found', status=404)
                item.name = item_form.cleaned_data["name"]
                item.description = item_form.cleaned_data["description"]
                item.random = item_form.cleaned_data["random"]
                item.save()

                tags = item.getTags()

                ex_tag_vals = []

                for tag in tags:
                    ex_tag_vals.append(tag.value)

                for t in item_form.cleaned_data["tags"]:
                    if t not in ex_tag_vals:
                        tag = Tag(value=t)
                        tag.owner = item
                        tag.save()

                return HttpResponse('{"status":"created", "id":' + str(item.id) + '}', content_type='application/json')
            else:
                return HttpResponse("Invalid request data - " + item_form.errors.as_json(), status=400)
        except:
            return HttpResponse("Bad post data - " + request.body, status=400)
    elif request.method == 'DELETE':
        if item_id is not None:
            item = ItemDefinition.objects.get(id=item_id)
            gitlab_utility.delete_file(item.texture.imageUrl, PDUser.branch_for_user(user=request.user))
            tex = Texture.objects.get(id=item.texture.id)
            item.delete()
            tex.delete()
            dump_item_textures(request)
            return HttpResponse('Success')
        else:
            return HttpResponse('Item id required', status=400)
    else:
        return HttpResponse("Invalid Method", status=405)


@csrf_exempt
@login_required(login_url='/scenario/login/')
def upload_asset(request):
    if request.method == 'POST':
        form = AssetFileForm(request.POST, request.FILES)
        if form.is_valid():
            asset_type = form.cleaned_data["assetType"]
            asset_id = form.cleaned_data["assetId"]
            
            tex = Texture()

            additional_data = None

            try:
                additional_data = json.loads(form.cleaned_data["additionalData"])
            except:
                pass

            if asset_type == Asset.CHARACTER_COMPONENT:

                parent_set = ComponentSet.objects.get(pk=long(asset_id))

                t = additional_data["componentType"].replace(" ", "_")
                name = parent_set.name.replace(" ", "_") + "_" + t
                file_name = name + ".png"

                tex.name = "components/" + file_name

                char_comp = CharacterComponent()
                char_comp.componentType = additional_data["componentType"]
                char_comp.name = name.replace(" ", "_")

                file_name = "components/" + file_name
                tex.imageUrl = file_name

                gitlab_utility.create_file(gitlab_utility.get_project_name(),
                                           PDUser.branch_for_user(user=request.user),
                                           file_name,
                                           request.FILES['file'].read(),
                                           "base64")

                tex.type = Texture.CHARACTER_COMPONENT
                tex.save()

                char_comp.texture = tex

                char_comp.componentSet = parent_set

                char_comp.save()

            elif asset_type == Asset.ITEM:

                item_def = ItemDefinition.objects.get(id=long(asset_id))

                name = item_def.name.replace(" ", "_")
                file_name = name + ".png"

                tex.name = "items/" + file_name
                file_name = "items/" + file_name
                tex.imageUrl = file_name

                gitlab_utility.create_file(gitlab_utility.get_project_name(),
                                           PDUser.branch_for_user(user=request.user),
                                           file_name, request.FILES['file'].read(),
                                           "base64")
                tex.type = Texture.ITEM
                tex.save()
                item_def.texture = tex
                item_def.save()

                item_textures = Texture.objects.filter(type=Texture.ITEM).all()
                assets = {'assets': []}

                for tex in item_textures:
                    d = tex.asDict()
                    d.pop("imageUrl", None)
                    d['type'] = 'texture'
                    assets['assets'].append(d)

                gitlab_utility.update_file(gitlab_utility.get_project_name(),
                                           PDUser.branch_for_user(user=request.user),
                                           "item-textures.json",
                                           json.dumps(assets, sort_keys=True, indent=4, separators=(',', ': ')),
                                           "text")

            elif asset_type == Asset.MESH:
                pass
            return HttpResponse(status=200)

        else:
            return HttpResponse("Bad asset request - " + form.errors.as_json(), status=400)
    else:
        return HttpResponse("Invalid Method", status=405)


@login_required(login_url='/scenario/login/')
def trigger_service(request, trigger_id):
    if request.method == 'GET':
        out = []
        if trigger_id is not None:
            try:
                out_obj = Trigger.objects.get(id=trigger_id)
                out.append(out_obj.asDict())
            except:
                return HttpResponse("Object could not be found", status=404)
        else:
            out_obj = list(Trigger.objects.all())
            for obj in out_obj:
                out.append(obj.asDict())
        json_str = json.dumps(list(out), sort_keys=True, indent=4, separators=(',', ': '))
        return HttpResponse(content=json_str, content_type=APPLICATION_JSON)

    elif request.method == 'POST' or request.method == 'PUT':
        json_data = json.loads(request.body)
        trigger_form = TriggerForm(json_data)
        trigger_args = []
        if trigger_form.is_valid():
            for arg in json_data['args']:
                arg_form = TriggerArgumentForm(arg)
                if arg_form.is_valid():
                    trigger_args.append(arg_form)
                else:
                    return HttpResponse("Invalid request data - " + arg_form.errors.as_json(), status=400)
        else:
            return HttpResponse("Invalid request data - " + trigger_form.errors.as_json(), status=400)

        if request.method == 'PUT':
            trigger = Trigger(type=trigger_form.cleaned_data['type'],
                              description=trigger_form.cleaned_data['description'],
                              condition=trigger_form.cleaned_data['condition']
                              )
            trigger.save()
            for arg in trigger_args:
                trigger_arg = TriggerArgument(
                    dataType=arg.cleaned_data['dataType'],
                    field=arg.cleaned_data['field'],
                    dependsOn=arg.cleaned_data['dependsOn'],
                    trigger=trigger
                )
                trigger_arg.save()
        # UPDATE
        else:
            trigger = Trigger.objects.get(id=trigger_id)
            trigger.type = trigger_form.cleaned_data['type']
            trigger.description = trigger_form.cleaned_data['description']
            trigger.condition = trigger_form.cleaned_data['condition']
            trigger.save()

            delArgs = []
            for arg in trigger.getArguments():
                found = False
                for a in trigger_args:
                    if a.cleaned_data['id'] == arg.id:
                        found = True
                        break
                if found == False:
                    delArgs.append(arg)

            for arg in delArgs:
                arg.delete()

            for arg in trigger_args:
                arg_obj = None
                try:
                    arg_obj = TriggerArgument.objects.get(id=long(arg.cleaned_data['id']))
                except:
                    arg_obj = TriggerArgument()
                arg_obj.dataType = arg.cleaned_data['dataType'],
                arg_obj.field = unicode(arg.cleaned_data['field'])
                arg_obj.trigger = trigger
                arg_obj.dependsOn = arg.cleaned_data['dependsOn']
                arg_obj.dataType = arg_obj.dataType[0]
                arg_obj.save()

        return HttpResponse("Success", status=200)

    elif request.method == 'DELETE':
        if trigger_id is not None:
            trigger = Trigger.objects.get(id=trigger_id)
            args = trigger.getArguments()
            for arg in args:
                TriggerArgument.delete(arg)
            Trigger.delete(trigger)
            return HttpResponse("Success", status=200)
        else:
            return HttpResponse("Must provide trigger id", status=400)


@login_required(login_url='/scenario/login/')
def post_process_component_set_service(request):
    if request.method == 'POST':
        in_data = json.loads(request.body)
        if 'id' in in_data:
            parent_set = ComponentSet.objects.get(pk=long(in_data['id']))
            if parent_set is not None:

                set_json_str = urllib2.urlopen(
                    gitlab_utility.get_project_url() + "/raw/" + PDUser.branch_for_user(
                        request.user) + "/" + parent_set.jsonRepresentation
                ).read()
                set_json_obj = json.loads(set_json_str)

                joints = set_json_obj["joints"]

                for charComp in parent_set.get_components():
                    tex = charComp.texture
                    if charComp.componentType.upper() == 'UPPER ARM' \
                            or charComp.componentType.upper() == 'LOWER JAW' \
                            or charComp.componentType.upper() == 'TORSO' \
                            or charComp.componentType.upper() == 'UPPER LEG' \
                            or charComp.componentType.upper() == 'PELVIS':
                        joints["texture"] = tex.id
                    elif charComp.componentType.upper() == 'LOWER ARM' \
                            or charComp.componentType.upper() == 'LOWER LEG' \
                            or charComp.componentType.upper() == 'UPPER JAW':
                        joints["components"][0]["texture"] = tex.id
                    elif charComp.componentType.upper() == 'HAND' \
                            or charComp.componentType.upper() == 'NOSE' \
                            or charComp.componentType.upper() == 'FOOT':
                        joints["components"][0]["components"][0]["texture"] = tex.id
                    elif charComp.componentType.upper() == 'LEFT EYE':
                        joints["components"][0]["components"][1]["texture"] = tex.id
                    elif charComp.componentType.upper() == 'RIGHT EYE':
                        joints["components"][0]["components"][2]["texture"] = tex.id
                    elif charComp.componentType.upper() == 'LEFT EYEBROW':
                        joints["components"][0]["components"][3]["texture"] = tex.id
                    elif charComp.componentType.upper() == 'RIGHT EYEBROW':
                        joints["components"][0]["components"][4]["texture"] = tex.id
                    elif charComp.componentType.upper() == 'RIGHT PUPIL':
                        joints["components"][0]["components"][2]['components'][0]["texture"] = tex.id
                    elif charComp.componentType.upper() == 'LEFT PUPIL':
                        joints["components"][0]["components"][1]['components'][0]["texture"] = tex.id

                    if 'textures' not in set_json_obj:
                        set_json_obj['textures'] = []

                    set_json_obj['textures'].append({
                        'id': tex.id,
                        'component': charComp.componentType
                    })

                url_comps = parent_set.jsonRepresentation.split("/")
                file_name = url_comps[len(url_comps) - 1]

                gitlab_utility.update_file(gitlab_utility.get_project_name(),
                                           PDUser.branch_for_user(user=request.user),
                                           "/components/definitions/" + file_name,
                                           json.dumps(set_json_obj, sort_keys=True, indent=4, separators=(',', ': ')),
                                           "text")

                comp_textures = Texture.objects.filter(type=Texture.CHARACTER_COMPONENT).all()
                assets = {'assets': []}

                for tex in comp_textures:
                    d = tex.asDict()
                    d.pop("imageUrl", None)
                    d['type'] = 'texture'
                    assets['assets'].append(d)

                gitlab_utility.update_file(gitlab_utility.get_project_name(),
                                           PDUser.branch_for_user(user=request.user),
                                           "component-textures.json",
                                           json.dumps(assets, sort_keys=True, indent=4, separators=(',', ': ')),
                                           "text")
                return HttpResponse('Success', status=200)
            else:
                return HttpResponse("Component set not found", status=404)
        else:
            return HttpResponse('id param is required', status=400)
    else:
        return HttpResponse("Invalid Method", status=405)


@login_required(login_url='/scenario/login/')
def asset_service(request, asset_id):
    if request.method == 'GET':
        if asset_id is not None:
            obj = Asset.objects.get(id=asset_id)
            if obj is not None:
                data = serializers.serialize('json', {obj, })
                return HttpResponse(data, content_type=APPLICATION_JSON)
            else:
                return HttpResponse("Object could not be found", status=404)
        else:
            return HttpResponse("ID required", status=405)
    elif request.method == 'POST':
        form = AssetForm(request.POST)
        asset = Asset()
        asset.name = form.name
        asset.description = form.description
        asset.assetType = form.assetType
        asset.componentSet = ComponentSet.get(id=form.componentSet)
        asset.save()
        return HttpResponse('{"status":"created", "id":' + str(asset.id) + '}', content_type=APPLICATION_JSON)
    else:
        return HttpResponse("Invalid Method", status=405)


def logout_user_view(request):
    logout(request)
    return redirect('index')


def proxy_service(request):
    if request.method == "GET":
        if 'url' in request.GET:
            url = urllib2.urlopen(request.GET["url"])
            http_message = url.info()
            content_type = http_message.type
            content = url.read()
            return HttpResponse(content, content_type=content_type)
        else:
            return HttpResponse("url param required", status=400)
    else:
        return HttpResponse("Invalid Method", status=405)


def texture_service(request, texture_id):
    if request.method == "GET":
        if texture_id is not None:
            if 'format' in request.GET and request.GET['format'] == 'image':
                try:
                    tex = Texture.objects.get(id=texture_id)
                except:
                    return HttpResponse('Texture could not be found', status=404)
                url = gitlab_utility.get_project_url() + "/raw/" + PDUser.branch_for_user(
                    request.user) + "/" + tex.imageUrl
                return HttpResponseRedirect(url)
            elif 'format' in request.GET and request.GET['format'] == 'url':
                try:
                    tex = Texture.objects.get(id=texture_id)
                except:
                    return HttpResponse('Texture could not be found', status=404)

                return HttpResponse(gitlab_utility.get_project_url() + "/raw/" + PDUser.branch_for_user(
                    request.user) + "/" + tex.imageUrl)
            else:
                tex_dict = Texture.objects.get(id=texture_id).asDict()
                return HttpResponse(json.dumps(tex_dict, sort_keys=True, indent=4, separators=(',', ': ')),
                                    content_type=APPLICATION_JSON)
        else:
            texturesArr = []
            textures = Texture.objects.all()
            for tex in textures:
                texturesArr.append(tex.asDict())
            return HttpResponse(json.dumps(texturesArr, sort_keys=True, indent=4, separators=(',', ': ')),
                                content_type=APPLICATION_JSON)
    return None


def gitlab_asset(request):
    if request.method == "GET":
        if 'asset' in request.GET:
            url = urllib2.urlopen(
                gitlab_utility.get_project_url() + "/raw/" + PDUser.branch_for_user(request.user) + "/" + request.GET[
                    "asset"])
            return HttpResponse(url.read())
        else:
            return HttpResponse("url param required", status=400)
    else:
        return HttpResponse("Invalid Method", status=405)


@login_required(login_url='/scenario/login/')
def dump_data_service(request):
    dump_component_textures(request)
    dump_item_textures(request)
    dump_component_definitions(request)
    dump_scenarios(request)
    return HttpResponse("Success")
