'use strict';

angular.module('scenarioEditor.assetView', ['ngRoute', 'scenarioServices'])

    .config(['$routeProvider', function ($routeProvider) {
        $routeProvider.when('/assetView', {
            templateUrl: '/scenario/assetView/',
            controller: 'assetCtrl'
        });
    }])

    .controller('assetCtrl', ['$scope', '$compile', '$http', '$route', function ($scope, $compile, $http, $route) {

        $scope.CONST = {};
        $scope.CONST.ASSET_TYPES = {
            NONE: -1,
            CHARACTER_COMPONENT: 1,
            ITEM: 2
        };

        // Current Asset
        $scope.asset = {};
        $scope.asset.name = "";
        $scope.asset.description = "";
        $scope.asset.tags = "";
        $scope.asset.type = "";
        $scope.asset.random = true;

        $scope.mode = 'CREATE';

        // @TODO Make this a server-side resource later on
        $scope.asset.types = [{
            id: $scope.CONST.ASSET_TYPES.NONE,
            label: 'Select Asset Type'
        },
            {
                id: $scope.CONST.ASSET_TYPES.CHARACTER_COMPONENT,
                label: 'Character Component'
            },
            {
                id: $scope.CONST.ASSET_TYPES.ITEM,
                label: 'Item'
            }
        ];

        $scope.dropzones = [];

        $scope.componentImages = [];

        $scope.componentAssetIds = [];

        $scope.dropzoneVisible = true;

        $scope.showCharacterComponentTypes = false;

        $scope.showFileUploaders = false;

        $scope.selectedComponentType = -1;

        $scope.selectedAsset = -1;

        $scope.assetId = -1;

        $scope.componentScale = 1;

        $scope.componentFilesConfirmed = false;

        $scope.joints = {};

        $scope.pendingComponentErrors = [];
        
        var dropzonesProcessed = 0;


        // EDIT VIEW
        $scope.query = {
            type: 'COMPONENT'
        };

        $scope.queryResults = [];

        $scope.queryChanged = function () {
            performQuery();
        };

        function performQuery() {
            var params = {};

            if ($scope.query.tags != null && $scope.query.tags.length > 0) {
                params["tags"] = $scope.query.tags;
            }

            if ($scope.query.name != null && $scope.query.name.length > 0) {
                params["name"] = $scope.query.name;
            }

            var endpoint = $scope.query.type == 'ITEM' ? 'item' : 'component_set';

            $http.get('/scenario/service/' + endpoint + '/', {
                params: params
            }).then(
                function (response) {
                    $scope.queryResults = response.data;
                },
                function (response) {
                    if (response.status != 404) {
                        $scope.$emit('showMessage', ['Asset query failed', 'danger']);
                    } else {
                        $scope.queryResults = [];
                    }
                }
            );
        }

        performQuery();

        $scope.$on('saveAsset', function (event, data) {
            var asset = data[0];
            if ($scope.query.type == 'ITEM' || $scope.query.type == 'COMPONENT') {

                var endpoint = $scope.query.type == 'ITEM' ? 'item' : 'component_set';

                var params = {
                    name: asset.name,
                    description: asset.description,
                    tags: asset.tags,
                    random : asset.random
                }

                $http.post('/scenario/service/' + endpoint + '/' + asset.id + "/", params).then(
                    function (response) {
                        $scope.$emit('blockUi', [false]);
                        $scope.$emit('showMessage', ['Asset updated', 'success']);
                    },
                    function (response) {
                        $scope.$emit('showMessage', ['Error updating asset', 'danger']);
                        $scope.$emit('blockUi', [false]);
                    }
                );
                $scope.$emit('blockUi', [true]);
            } else {
                $scope.$emit('showMessage', ['Invalid asset mode - ' + $scope.mode, 'danger']);
            }
        });

        $scope.$on('deleteAsset', function (event, data) {
            var asset = data[0];
            if ($scope.query.type == 'ITEM' || $scope.query.type == 'COMPONENT') {
                var endpoint = $scope.query.type == 'ITEM' ? 'item' : 'component_set';
                $http.delete('/scenario/service/' + endpoint + '/' + asset.id).then(
                    function (response) {
                        $scope.$emit('blockUi', [false]);
                        $scope.$emit('showMessage', ['Asset deleted', 'success']);
                        var idx = $scope.queryResults.indexOf(asset);
                        $scope.queryResults.splice(idx, 1);
                    },
                    function (response) {
                        $scope.$emit('showMessage', ['Error deleting asset', 'danger']);
                        $scope.$emit('blockUi', [false]);
                    }
                );
                $scope.$emit('blockUi', [true]);
            } else {
                $scope.$emit('showMessage', ['Invalid asset mode - ' + $scope.mode, 'danger']);
            }
        });
    
        // END EDIT VIEW

        $scope.componentTypes = [{
            id: -1,
            label: 'Select Component Type'
        }, {
            id: 1,
            label: 'Leg'
        }, {
            id: 2,
            label: 'Arm'
        }, {
            id: 3,
            label: 'Torso'
        }, {
            id: 4,
            label: 'Head'
        }, {
            id: 5,
            label: 'Pelvis'
        }];

        $scope.componentPartsByType = {
            "Arm": ["Upper Arm", "Lower Arm", "Hand"],
            "Leg": ["Upper Leg", "Lower Leg", "Foot"],
            "Torso": ["Torso"],
            "Head": ["Lower Jaw", "Upper Jaw", "Nose", 'Right Eye', 'Left Eye', 'Right Eyebrow', 'Left Eyebrow', "Left Pupil", "Right Pupil"],
            "Pelvis": ["Pelvis"]
        };

        $scope.onAssetTypeChanged = function () {
            resetFileUploaders();
            switch ($scope.selectedAsset.id) {

                case $scope.CONST.ASSET_TYPES.NONE :
                    $scope.showCharacterComponentTypes = false;
                    break;

                case $scope.CONST.ASSET_TYPES.CHARACTER_COMPONENT : // Character Component
                    $scope.showCharacterComponentTypes = true;
                    if ($scope.selectedComponentType.id != -1) {
                        $scope.onComponentTypeChange();
                    }
                    break;

                case $scope.CONST.ASSET_TYPES.ITEM :
                    addFileUploader("Item Texture");
                    $scope.showFileUploaders = true;
                    $scope.showCharacterComponentTypes = false;
                    break;
            }
        };

        $scope.onComponentTypeChange = function () {

            var componentParts = $scope.componentPartsByType[$scope.selectedComponentType.label];

            $(getFileUploadContainer()).empty();

            $scope.dropzones = [];

            for (var i = 0; i < componentParts.length; i++) {
                var dropzone = addFileUploader(componentParts[i]);
                var additionalData = {componentType: componentParts[i]};
                dropzone.attr('additional-data', JSON.stringify(additionalData));
            }

            $scope.showFileUploaders = true;
        };

        $scope.initJointPlacement = function () {

            var valid = true;
            var errors = [];

            for (var i = 0; i < $scope.dropzones.length; i++) {
                if ($scope.dropzones[i].files.length != 1) {
                    errors.push("A file is required for each component");
                    valid = false;
                    break;
                }
            }

            if (valid) {
                $scope.componentFilesConfirmed = true;
                $scope.componentImages = [];

                for (var i = 0; i < $scope.componentPartsByType[$scope.selectedComponentType.label].length; i++) {
                    $scope.componentImages.push($scope.componentPartsByType[$scope.selectedComponentType.label][i]);
                }
            } else {
                for (var i = 0; i < errors.length; i++) {
                    $scope.$emit('showMessage', [errors[i], 'danger']);
                }
            }
        };

        $scope.uploadAsset = function () {

            var valid = true;
            var errors = [];

            if ($scope.asset.name == "") {
                errors.push('Name is required');
                valid = false;
            }
            
            for(var i = 0; i < $scope.pendingComponentErrors.length; i++){
                errors.push($scope.pendingComponentErrors[i]);
            }
            
            $scope.pendingComponentErrors = [];

            if (errors.length == 0) {
                // Tell the app controller to block the ui
                switch ($scope.selectedAsset.id) {
                    case $scope.CONST.ASSET_TYPES.CHARACTER_COMPONENT :

                        var valid = true;
                        var errors = [];

                        if ($scope.selectedComponentType.id == -1) {
                            errors.push('A valid component type must be selected');
                            valid = false;
                        }

                        for (var i = 0; i < $scope.dropzones.length; i++) {
                            if ($scope.dropzones[i].files.length != 1) {
                                errors.push('A file is required for each component');
                                valid = false;
                                break;
                            }
                        }

                        if (Object.getOwnPropertyNames($scope.joints).length == 0) {
                            errors.push('Joints must be specified');
                            valid = false;
                        }

                        if (valid) {
                            // Setup the appropriate data object for a component set

                            var joints = {textures: [], joints: $scope.joints};

                            var compSetData = {
                                name: $scope.asset.name,
                                description: $scope.asset.description,
                                random:$scope.asset.random,
                                tags: $scope.asset.tags,
                                setType: $scope.selectedComponentType.label.toUpperCase(),
                                joints: JSON.stringify(joints)
                            };

                            $scope.$emit('blockUi', [true]);

                            // Create a component set and get the id that is returned
                            $http.post('/scenario/service/component_set/', compSetData).then(
                                function (response) { // success

                                    $scope.assetId = response.data.id;

                                    for (var i = 0; i < $scope.dropzones.length; i++) {
                                        var dropzone = $('div[dropzone_' + i + ']');
                                        dropzone.attr('asset-id', $scope.assetId);
                                        dropzone.attr('asset-type', $scope.selectedAsset.label);
                                    }

                                    $scope.dropzones[0].processQueue();
                                },

                                //@TODO Add some proper error notification
                                function (response) { // failure
                                    alert("Error creating component set - " + response.data);
                                    $scope.$emit('blockUi', [false]);
                                }
                            );
                        } else {
                            for (var i = 0; i < errors.length; i++) {
                                $scope.$emit('showMessage', [errors[i], 'danger']);
                            }
                        }

                        break;

                    case $scope.CONST.ASSET_TYPES.ITEM:

                        if ($scope.dropzones[0].files.length == 1) {

                            // Create the appropriate data object for an item
                            var itemData = {
                                name: $scope.asset.name,
                                description: $scope.asset.description,
                                tags: $scope.asset.tags,
                                random: $scope.asset.random
                                // Extra item attributes
                            };

                            $scope.$emit('blockUi', [true]);

                            // Create an item set and get the id that is returned
                            $http.post('/scenario/service/item/', itemData).then(
                                function (response) { // success

                                    $scope.assetId = response.data.id;

                                    //@TODO Why?
                                    for (var i = 0; i < $scope.dropzones.length; i++) {
                                        var dropzone = $('div[dropzone_' + i + ']');
                                        dropzone.attr('asset-id', $scope.assetId);
                                        dropzone.attr('asset-type', $scope.selectedAsset.label);
                                    }

                                    $scope.dropzones[0].processQueue();
                                },
                                function (response) { // failure
                                    alert(response.data);
                                    $scope.$emit('blockUi', [false]);
                                }
                            );
                        } else {
                            $scope.$emit('showMessage', ['Item texture is required', 'danger']);
                        }
                        break;
                }
            } else {
                for (var i = 0; i < errors.length; i++) {
                    $scope.$emit('showMessage', [errors[i], 'danger']);
                }
            }
        };

        /**
         * The dropzones need to be processed syncronously so that Gitlab doesn't throw
         * an error due to simultaneous commits. When a dropzone has committed its file
         * it will emit a dropzoneComplete event. When this is recieved we tell the next
         * on in the array to commit its file
         */
        $scope.$on('dropzoneComplete', function (event, data) {
            dropzonesProcessed++;
            if (dropzonesProcessed == $scope.dropzones.length) {
                if ($scope.selectedAsset.id == $scope.CONST.ASSET_TYPES.CHARACTER_COMPONENT) {
                    $http.post(
                        '/scenario/service/post_process_component_set/',
                        {id: $scope.assetId}
                    ).then(
                        function (response) {
                            // Successfully uploaded all of the files
                            $scope.$emit('showMessage', ['Asset created successfully', 'success']);
                            $route.reload();
                            $scope.$emit('blockUi', [false]);
                        },
                        function (response) {
                            $scope.$emit('showMessage', ['Error Post Processing Component Set', 'danger']);
                        }
                    );
                } else {
                    $scope.$emit('showMessage', ['Asset created successfully', 'success']);
                    $route.reload();
                    $scope.$emit('blockUi', [false]);
                    $scope.$apply();
                }
            } else {
                // Use the dropzonesProcessed as the idx since we process the first one outside
                // of this function
                $scope.dropzones[dropzonesProcessed].processQueue();
            }
        });

        function getFileUploadContainer() {
            return angular.element(document.getElementById('file-upload-container'));
        }

        function addFileUploader(label) {
            var container = getFileUploadContainer();
            container.append($compile(
                "<span>File for " + label + "</span><div file-uploader id='drop_zone' asset-type='' dropzone_" + $scope.dropzones.length + " asset-id='' dropzones='dropzones' additional-data=''></div><br/>"
            )($scope));
            // append adds to dropzones so use the length minus one
            return $("div[dropzone_" + ($scope.dropzones.length - 1) + "]");
        }

        function resetFileUploaders() {
            $scope.dropzones = [];
            var cont = getFileUploadContainer();
            $(cont).html("");
        }

    }])

    .directive('assetResult', ['$compile', function ($compile) {
        return {
            template: "<td ng-if='state==\"view\"'>{$obj.name$}</td>" +
            "<td ng-if='state==\"view\"'>{$obj.description$}</td>" +
            "<td ng-if='state==\"view\"'>{$obj.tags$}</td>" +
            "<td ng-if='state==\"view\"'><input type='checkbox' disabled ng-model='obj.random'/></td>" +
            "<td ng-if='state==\"edit\"'><input type='text' ng-model='obj.name'/></td>" +
            "<td ng-if='state==\"edit\"'><input type='text' ng-model='obj.description'/></td>" +
            "<td ng-if='state==\"edit\"'><input type='text' ng-model='obj.tags'/></td>" +
            "<td ng-if='state==\"edit\"'><input type='checkbox' ng-model='obj.random'/></td>" +
            "<td>{$obj.setType$}</td>" +
            "<td id='img-container'></td>" +
            "<td>" +
            "<span ng-click='onDelete()' class='glyphicon glyphicon-remove clickable hover-fade action-icon'></span>" +
            "<span ng-if='state==\"view\"' ng-click='onEdit()' class='glyphicon glyphicon-edit clickable hover-fade action-icon'></span>" +
            "<span ng-if='state==\"edit\"' ng-click='onSave()' class='glyphicon glyphicon-floppy-save clickable hover-fade action-icon'></span>" +
            "</td>",
            scope: {
                obj: "=sweetTarget",
                type: "@sweetType"
            },
            transclude: true,
            link: function ($scope, element, attrs, ctrls) {

                $scope.state = 'view';

                var res = "";

                var tags = $scope.obj.tags;

                for (var i = 0; i < tags.length; i++) {
                    res += tags[i].value + ",";
                }

                if (res.length > 0) {
                    res = res.substr(0, res.length - 1);
                }

                $scope.obj.tags = res;

                if ($scope.type == 'ITEM') {
                    $(element).find("#img-container").append($compile("<img class='thumbnail-small' ng-src='/scenario/service/texture/" + $scope.obj.texture.id + "?format=image'/>")($scope));
                } else {
                    for (var i = 0; i < $scope.obj.components.length; i++) {
                        $(element).find("#img-container").append($compile("<img class='thumbnail-small' ng-src='/scenario/service/texture/" + $scope.obj.components[i].texture.id + "?format=image'/>")($scope));
                    }
                }

                $scope.onDelete = function () {
                    var msg = "Are you sure?";
                    if (window.confirm(msg)) {
                        $scope.$emit('deleteAsset', [$scope.obj]);
                    }
                };

                $scope.onSave = function () {
                    $scope.$emit('saveAsset', [$scope.obj]);
                    $scope.state = 'view';
                };

                $scope.onEdit = function () {
                    $scope.state = 'edit';
                }
            }
        }
    }])

    // Directive for dropzone file uploader
    .directive('fileUploader', ['$parse', function ($parse) {
        return {
            restrict: 'AE',
            template: '<div ng-transclude></div>',
            transclude: true,
            scope: {
                eventHandlers: '=',
                dropzones: "=dropzones",
                assetId: "@",
                additionalData: "@",
                assetName: "@"
            },

            link: function ($scope, element, attrs, ctrls) {
                try {
                    Dropzone
                }

                catch (error) {
                    throw new Error('Dropzone.js not loaded.');
                }

                // @TODO Why do we have to do this
                var assetId = null;
                var assetName = null;
                var additionalData = null;

                var dropzone = new Dropzone(element[0], {
                    url: "/scenario/upload_asset/",
                    autoProcessQueue: false,

                    resize: function (file) {

                        return {
                            srcX: 0,
                            srcY: 0,
                            trgX: 0,
                            trgY: 0,
                            srcWidth: file.width,
                            srcHeight: file.height,
                            trgWidth: file.width,
                            trgHeight: file.height
                        };
                    },

                    sending: function (file, xhr, formData) {
                        //@TODO How do we do this properly
                        var id = $(dropzone.element).attr("asset-id");
                        var type = $(dropzone.element).attr("asset-type");
                        var data = $(dropzone.element).attr("additional-data");
                        formData.append("assetId", id);
                        formData.append("assetType", type.toUpperCase());
                        formData.append("additionalData", data);
                    },

                    init: function () {
                        this.on("addedfile", function () {
                            if (this.files[1] != null) {
                                this.removeFile(this.files[0]);
                            }
                        });
                    }
                });

                dropzone.on("success", function (file, response) {
                    $scope.$emit('dropzoneComplete', []);
                });

                dropzone.on("error", function (file, response) {
                    $scope.$emit('blockUi', [false]);
                    alert("Error uploading asset file - " + response);
                });

                if ($scope.eventHandlers) {
                    Object.keys($scope.eventHandlers).forEach(function (eventName) {
                        dropzone.on(eventName, $scope.eventHandlers[eventName]);
                    });
                }


                dropzone.process = function () {
                    $scope.$evalAsync(function () {
                        dropzone.processQueue();
                    });
                };

                $scope.dropzones.push(dropzone);
            }
        };
    }])
    .directive('componentBuilder', [
        function () {
            return {

                scope: {
                    components: "=",
                    componentType: "=",
                    componentScale: "=",
                    joints: "=",
                    pendingErrors: "="
                },

                transclude: true,

                template: '<div id="c-wrapper"><canvas id="c" class="component-builder"></canvas></div>',

                link: function ($scope, element, attr) {

                    var componentImages = [];

                    // @TODO is there a better way to do this?
                    var componentRelationShips = {
                        "Arm": "Upper Arm>Lower Arm>Hand>OUT",
                        "Leg": "Upper Leg>Lower Leg>Foot>OUT",
                        "Torso": "Torso>Neck,Torso>Left Arm,Torso>Right Arm",
                        "Head": "Lower Jaw>Upper Jaw,Upper Jaw>Nose,Upper Jaw>Left Eye>Left Pupil,Upper Jaw>Right Eye>Right Pupil,Upper Jaw>Left Eyebrow,Upper Jaw>Right Eyebrow,Upper Jaw>OUT",
                        "Pelvis": "Pelvis>Torso,Pelvis>Right Leg,Pelvis>Left Leg"
                    };

                    var canvas = new fabric.Canvas('c');
                    canvas.selection = false;
                    canvas.setHeight(1280);
                    canvas.setWidth(1280);

                    var inJointGroup = null;

                    // @TODO - Combine these two arrays into one array of objects 
                    var outJoints = [];
                    var outJointLabels = [];

                    var jointId = 0;

                    var shiftDown = false;

                    var canvasWrapper = document.getElementById("c-wrapper");

                    canvasWrapper.tabIndex = 1000;

                    $scope.$watch('components', function (value) {

                        clearExisting();

                        var imgElems = $(".dz-image img");
                        var lx = 0.0;
                        for (var i = 0; i < imgElems.length; i++) {
                            var imgInstance = new fabric.Image(imgElems[i], {
                                left: 10 + lx,
                                top: 200
                            });

                            imgInstance.hasControls = false;
                            //imgInstance.hasBorders = false;

                            canvas.add(imgInstance);
                            componentImages.push(imgInstance);

                            lx += imgInstance.width / 4;

                            if ($scope.components[componentImages.length - 1].toLowerCase().indexOf('left') != -1) {
                                var filter = new fabric.Image.filters.Tint({
                                    color: '#ff0000',
                                    opacity: 0.8
                                });
                                imgInstance.filters.push(filter);
                                imgInstance.applyFilters(canvas.renderAll.bind(canvas));
                            }
                            else if ($scope.components[componentImages.length - 1].toLowerCase().indexOf('right') != -1) {
                                var filter = new fabric.Image.filters.Tint({
                                    color: '#0000ff',
                                    opacity: 0.8
                                });
                                imgInstance.filters.push(filter);
                                imgInstance.applyFilters(canvas.renderAll.bind(canvas));
                            }
                        }

                        var rels = componentRelationShips[$scope.componentType.label];

                        if (rels != undefined) {

                            var sets = rels.split(",");

                            for (var i = 0; i < sets.length; i++) {
                                var parts = sets[i].split(">");
                                console.log(parts);
                                for (var j = 0; j < parts.length - 1; j++) {
                                    addOutJoint(parts[j] + " - " + parts[j + 1]);
                                }
                            }
                        }
                        inJointGroup.moveTo(1000);
                    });

                    $scope.$watch('componentScale', function (value) {
                        for (var i = 0; i < componentImages.length; i++) {
                            componentImages[i].scaleX = value;
                            componentImages[i].scaleY = value;
                        }
                        canvas.renderAll();

                    });

                    canvasWrapper.addEventListener("keydown", function (e) {
                        if (e.shiftKey) {
                            shiftDown = true;
                        }

                    }, false);

                    canvasWrapper.addEventListener("keyup", function (e) {
                        if (e.shiftKey == false) {
                            shiftDown = false;
                        }

                    }, false);

                    // Calculates the joint/image percentages for all components
                    // This is probably overly complicated and can probably be cleaned up/improved
                    function calculateJointPercentages() {
                        var rels = [];

                        if (componentImages.length > 0) {
                            var rootComponentImg = componentImages[0];
                            rels[0] = {
                                joint: {
                                    parent: "IN",
                                    child: $scope.components[0]
                                },
                                component: $scope.components[0],
                                percentages: calculateJointImgRelationship(inJointGroup, rootComponentImg)
                            };
                            var sets = componentRelationShips[$scope.componentType.label].split(",");
                            for (var x = 0; x < sets.length; x++) {
                                var s = 0;
                                var comps = sets[x].split(">");
                                for (var i = 0; i < comps.length - 1;) {
                                    var compName = comps[i + s];
                                    var imgIdx = $scope.components.indexOf(compName);
                                    var jointName = comps[i] + " - " + comps[i + 1];
                                    var jointIdx = outJointLabels.indexOf(jointName) + s;
                                    if (imgIdx >= 0) {
                                        var componentImg = componentImages[imgIdx];
                                        rels.push({
                                            joint: {
                                                parent: comps[i],
                                                child: comps[i + 1]
                                            },
                                            component: comps[i + s],
                                            percentages: calculateJointImgRelationship(
                                                outJoints[jointIdx - s], componentImg)
                                        });
                                    }
                                    s++;
                                    if (s == 2) {
                                        i++;
                                        s = 0;
                                    }
                                }
                            }
                        }

                        var converted = {};

                        var compType = $scope.componentType.label.toUpperCase();

                        switch (compType) {
                            case "ARM":
                                converted = {
                                    id: "Upper Arm",
                                    texture: "",
                                    in: [parseFloat(rels[0]['percentages']['x'].toFixed(6)), parseFloat(rels[0]['percentages']['y'].toFixed(6))],
                                    out: [[parseFloat(rels[1]['percentages']['x'].toFixed(6)), parseFloat(rels[1]['percentages']['y'].toFixed(6)), "ANY"]],
                                    components: [
                                        {
                                            id: "Lower Arm",
                                            texture: "",
                                            in: [parseFloat(rels[2]['percentages']['x'].toFixed(6)), parseFloat(rels[2]['percentages']['y'].toFixed(6))],
                                            out: [[parseFloat(rels[3]['percentages']['x'].toFixed(6)), parseFloat(rels[3]['percentages']['y'].toFixed(6)), "ANY"]],
                                            components: [
                                                {
                                                    id: "Hand",
                                                    texture: "",
                                                    in: [parseFloat(rels[4]['percentages']['x'].toFixed(6)), parseFloat(rels[4]['percentages']['y'].toFixed(6))],
                                                    out: [[parseFloat(rels[5]['percentages']['x'].toFixed(6)), parseFloat(rels[5]['percentages']['y'].toFixed(6)), "ANY"]]
                                                }
                                            ]
                                        }
                                    ]
                                };
                                break;

                            case "LEG":
                                converted = {
                                    id: "Upper Leg",
                                    texture: "",
                                    in: [parseFloat(rels[0]['percentages']['x'].toFixed(6)), parseFloat(rels[0]['percentages']['y'].toFixed(6))],
                                    out: [[parseFloat(rels[1]['percentages']['x'].toFixed(6)), parseFloat(rels[1]['percentages']['y'].toFixed(6)), "ANY"]],
                                    components: [
                                        {
                                            id: "Lower Leg",
                                            texture: "",
                                            in: [parseFloat(rels[2]['percentages']['x'].toFixed(6)), parseFloat(rels[2]['percentages']['y'].toFixed(6))],
                                            out: [[parseFloat(rels[3]['percentages']['x'].toFixed(6)), parseFloat(rels[3]['percentages']['y'].toFixed(6)), "ANY"]],
                                            components: [
                                                {
                                                    id: "Foot",
                                                    texture: "",
                                                    in: [parseFloat(rels[4]['percentages']['x'].toFixed(6)), parseFloat(rels[4]['percentages']['y'].toFixed(6))],
                                                    out: [[parseFloat(rels[5]['percentages']['x'].toFixed(6)), parseFloat(rels[5]['percentages']['y'].toFixed(6)), "ANY"]]
                                                }
                                            ]
                                        }
                                    ]
                                };
                                break;

                            case "TORSO":
                                converted = {
                                    id: "Neck",
                                    texture: "",
                                    in: [parseFloat(rels[0]['percentages']['x'].toFixed(6)), parseFloat(rels[0]['percentages']['y'].toFixed(6))],
                                    out: [
                                        [parseFloat(rels[1]['percentages']['x'].toFixed(6)), parseFloat(rels[1]['percentages']['y'].toFixed(6)), "ANY"],
                                        [parseFloat(rels[2]['percentages']['x'].toFixed(6)), parseFloat(rels[2]['percentages']['y'].toFixed(6)), "ANY"],
                                        [parseFloat(rels[3]['percentages']['x'].toFixed(6)), parseFloat(rels[3]['percentages']['y'].toFixed(6)), "ANY"]]
                                };
                                break;

                            case "PELVIS":
                                converted = {
                                    id: "OUT",
                                    texture: "",
                                    in: [parseFloat(rels[0]['percentages']['x'].toFixed(6)), parseFloat(rels[0]['percentages']['y'].toFixed(6))],
                                    out: [
                                        [parseFloat(rels[1]['percentages']['x'].toFixed(6)), parseFloat(rels[1]['percentages']['y'].toFixed(6)), "ANY"],
                                        [parseFloat(rels[2]['percentages']['x'].toFixed(6)), parseFloat(rels[2]['percentages']['y'].toFixed(6)), "ANY"],
                                        [parseFloat(rels[3]['percentages']['x'].toFixed(6)), parseFloat(rels[3]['percentages']['y'].toFixed(6)), "ANY"]]
                                };
                                break;

                            case "HEAD":
                                converted = {
                                    id: "Lower Jaw",
                                    texture: "",
                                    in: [parseFloat(rels[0]['percentages']['x'].toFixed(6)), parseFloat(rels[0]['percentages']['y'].toFixed(6))],
                                    out: [[parseFloat(rels[1]['percentages']['x'].toFixed(6)), parseFloat(rels[1]['percentages']['y'].toFixed(6)), "ANY"]],
                                    components: [
                                        {
                                            id: "Upper Jaw",
                                            texture: "",
                                            in: [parseFloat(rels[2]['percentages']['x'].toFixed(6)), parseFloat(rels[2]['percentages']['y'].toFixed(6))],
                                            out: [
                                                [parseFloat(rels[3]['percentages']['x'].toFixed(6)), parseFloat(rels[3]['percentages']['y'].toFixed(6)), "ANY"], // Nose
                                                [parseFloat(rels[5]['percentages']['x'].toFixed(6)), parseFloat(rels[5]['percentages']['y'].toFixed(6)), "ANY"], // Left Eye
                                                [parseFloat(rels[9]['percentages']['x'].toFixed(6)), parseFloat(rels[9]['percentages']['y'].toFixed(6)), "ANY"], // Right Eye
                                                [parseFloat(rels[13]['percentages']['x'].toFixed(6)), parseFloat(rels[13]['percentages']['y'].toFixed(6)), "ANY"],  // Left Eyebrow
                                                [parseFloat(rels[15]['percentages']['x'].toFixed(6)), parseFloat(rels[15]['percentages']['y'].toFixed(6)), "ANY"]// Right Eyebrow
                                            ],
                                            components: [
                                                {
                                                    id: "Nose",
                                                    texture: "",
                                                    in: [parseFloat(rels[4]['percentages']['x'].toFixed(6)), parseFloat(rels[4]['percentages']['y'].toFixed(6))],
                                                    out: [[parseFloat(rels[4]['percentages']['x'].toFixed(6)), parseFloat(rels[4]['percentages']['y'].toFixed(6)), "ANY"]]
                                                },
                                                {
                                                    id: "Left Eye",
                                                    texture: "",
                                                    in: [parseFloat(rels[6]['percentages']['x'].toFixed(6)), parseFloat(rels[6]['percentages']['y'].toFixed(6))],
                                                    out: [[parseFloat(rels[6]['percentages']['x'].toFixed(6)), parseFloat(rels[6]['percentages']['y'].toFixed(6)), "ANY"]],
                                                    components: [
                                                        {
                                                            id: "Left Pupil",
                                                            texture: "",
                                                            in: [parseFloat(rels[8]['percentages']['x'].toFixed(6)), parseFloat(rels[8]['percentages']['y'].toFixed(6))],
                                                            out: [[parseFloat(rels[8]['percentages']['x'].toFixed(6)), parseFloat(rels[8]['percentages']['y'].toFixed(6)), "ANY"]]
                                                        }
                                                    ]
                                                },
                                                {
                                                    id: "Right Eye",
                                                    texture: "",
                                                    in: [parseFloat(rels[10]['percentages']['x'].toFixed(6)), parseFloat(rels[10]['percentages']['y'].toFixed(6))],
                                                    out: [[parseFloat(rels[10]['percentages']['x'].toFixed(6)), parseFloat(rels[10]['percentages']['y'].toFixed(6)), "ANY"]],
                                                    components: [
                                                        {
                                                            id: "Right Pupil",
                                                            texture: "",
                                                            in: [parseFloat(rels[12]['percentages']['x'].toFixed(6)), parseFloat(rels[12]['percentages']['y'].toFixed(6))],
                                                            out: [[parseFloat(rels[12]['percentages']['x'].toFixed(6)), parseFloat(rels[12]['percentages']['y'].toFixed(6)), "ANY"]]
                                                        }
                                                    ]
                                                },
                                                {
                                                    id: "Left Eyebrow",
                                                    texture: "",
                                                    in: [parseFloat(rels[14]['percentages']['x'].toFixed(6)), parseFloat(rels[14]['percentages']['y'].toFixed(6))],
                                                    out: [[parseFloat(rels[14]['percentages']['x'].toFixed(6)), parseFloat(rels[14]['percentages']['y'].toFixed(6)), "ANY"]]
                                                },
                                                {
                                                    id: "Right Eyebrow",
                                                    texture: "",
                                                    in: [parseFloat(rels[16]['percentages']['x'].toFixed(6)), parseFloat(rels[16]['percentages']['y'].toFixed(6))],
                                                    out: [[parseFloat(rels[16]['percentages']['x'].toFixed(6)), parseFloat(rels[16]['percentages']['y'].toFixed(6)), "ANY"]]
                                                }
                                            ]
                                        }
                                    ]
                                };
                                break;
                        }
                        
                        $scope.pendingErrors = [];
                        
                        var compLeft = null;
                        var compLeftVal = "";
                        
                        for(var i = 0; i < outJoints.length; i++){
                            var comp = outJoints[i].item(1);
                            if(comp.getText().indexOf('Left') != -1){
                                var st = comp.getText().split("-")[1];
                                st = st.trim();
                                st = st.split(" ")[1];
                                compLeft = outJoints[i];
                                compLeftVal = st;
                            }
                        }
                        
                        var compRight = null;
                        for(var i = 0; i < outJoints.length; i++){
                            var comp = outJoints[i].item(1);
                            if(comp.getText().indexOf('Right') != -1 && comp.getText().indexOf(compLeftVal) != -1){
                                compRight = outJoints[i];
                            }
                        }
        
                        if(compLeft != null && compRight != null){
                            if(compLeft.left > compRight.left){
                                $scope.pendingErrors.push("Left joint is to the right of right joint");
                            }
                        }
                        
                        for(var i = 0; i < outJoints.length; i++){
                            if(outJoints.top == 50){
                                $scope.pendingErrors.push("Not all joints have been set");
                                break;
                            }
                        }
                        
                        if(inJointGroup.top == 50){
                            $scope.pendingErrors.push("Not all joints have been set");
                        }
                        
                        $scope.joints = converted;

                        // Since we're in a watch we need to run an apply
                        $scope.$apply();

                        console.log(JSON.stringify(converted));

                        return rels;
                    }

                    // Calculates the relationship between a specific joint and image
                    function calculateJointImgRelationship(joint, img) {

                        var ix = img.left;
                        var iy = img.top;
                        var iw = img.width * img.scaleX;
                        var ih = img.height * img.scaleY;

                        var jx = joint.width / 2 + joint.left - ix;
                        var jy = joint.height + joint.top - iy - ih - joint.item(0).height / 2;

                        var imgXPerc = jx / iw;
                        var imgYPerc = -1 * (jy / ih);

                        return {
                            x: imgXPerc,
                            y: imgYPerc
                        };
                    }

                    /**
                     * Clears out the existing images and out joint objects from
                     * the canvas, as well as empties out the corresponding arrays
                     */
                    function clearExisting() {
                        for (var i = 0; i < outJoints.length; i++) {
                            canvas.remove(outJoints[i]);
                        }
                        outJoints = [];
                        outJointLabels = [];
                        for (var i = 0; i < componentImages.length; i++) {
                            canvas.remove(componentImages[i]);
                        }

                        componentImages = [];
                    }

                    function canvasKeyDown(e) {
                        console.log("shift");
                        if (e.shiftKey == true) {
                            shiftDown = true;
                        }
                    }

                    // Creates the circle for an out joint
                    function createOutJoint() {
                        var circ = new fabric.Circle({
                            radius: 5,
                            fill: '#55f',
                            top: 0,
                            left: 0,
                            id: jointId
                        });
                        circ.hasControls = false;
                        circ.hasBorders = false;
                        jointId++;
                        return circ;
                    }

                    // Creates the circle for an in joint
                    function createInJoint() {
                        var circ = new fabric.Circle({
                            radius: 5,
                            fill: '#f55',
                            top: 0,
                            left: 0,
                            id: jointId
                        });
                        circ.hasControls = false;
                        circ.hasBorders = false;
                        jointId++;
                        return circ;
                    }


                    function addOutJoint(labelText) {
                        var joint = createOutJoint();

                        var label = new fabric.Text(labelText, {
                            left: 0,
                            top: 0,
                            stroke: null,
                            fill: "#000000",
                            fontSize: 20,
                            backgroundColor: "#ffffff"
                        });

                        // This puts the center of the joint at the group's 0,0
                        joint.left = -joint.width / 2;
                        joint.top = -joint.height / 2;

                        label.left = -label.width / 2;
                        label.top = -label.height - joint.height;

                        var group = new fabric.Group([joint, label], {
                            top: 50,
                            left: 120 + (120 * outJoints.length)
                        });
                        group.hasControls = false;
                        group.hasBorders = false;
                        canvas.add(group);

                        outJoints.push(group);
                        outJointLabels.push(labelText);
                    }

                    function addInJoint() {
                        var joint = createInJoint();

                        var label = new fabric.Text("In Joint", {
                            left: 0,
                            top: 0,
                            stroke: null,
                            fill: "#000000",
                            fontSize: 20,
                            backgroundColor: "#ffffff"
                        });

                        joint.left = -joint.width / 2;
                        joint.top = -joint.height / 2;

                        label.left = -label.width / 2;
                        label.top = -label.height - joint.height;

                        var group = new fabric.Group([joint, label], {
                            left: 50,
                            top: 50
                        });
                        group.hasControls = false;
                        group.hasBorders = false;
                        canvas.add(group);
                        inJointGroup = group;
                    }

                    function deleteOutJoint(joint) {
                        canvas.remove(joint);
                        outJoints.splice(indexOfJoint(outJoints, joint), 1);
                    }

                    addInJoint();

                    var outJointrect = new fabric.Rect({
                        left: 2,
                        top: 8,
                        fill: '#55f',
                        width: 20,
                        height: 20,
                        rx: 5,
                        ry: 5
                    });

                    function indexOfJoint(array, value) {
                        for (var i = 0; i < array.length; i++) {
                            if (array[i].id == value.id) {
                                return i;
                            }
                        }
                        return -1;
                    }

                    canvas.on({
                        'mouse:down': function (e) {
                            if (e.target) {
                                if (shiftDown == true) {
                                    if (indexOfJoint(outJoints, e.target) >= 0) {
                                        deleteOutJoint(e.target);
                                    }
                                }
                                else {
                                    e.target.opacity = 0.5;
                                    canvas.renderAll();
                                }
                            }
                        },
                        'mouse:up': function (e) {
                            if (e.target) {
                                e.target.opacity = 1;
                                canvas.renderAll();
                            }
                            canvas.renderAll();
                            calculateJointPercentages();
                        },
                        'object:moved': function (e) {
                            e.target.opacity = 0.5;
                        },
                        'object:modified': function (e) {
                            e.target.opacity = 1;
                        }
                    });
                }
            };
        }
    ]);