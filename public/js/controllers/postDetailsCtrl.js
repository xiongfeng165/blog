'use strict';

app.factory("MarkDownConverter", function(){
	var converter = Markdown.getSanitizingConverter();
	var Extra = Markdown.Extra.init(converter, {
		extensions: "all",
		highlighter: "prettify"
	});

	return Extra.converter;
});

app.controller('TopicDetail', function($scope, $routeParams, blogService, $location, MarkDownConverter, $sce, $timeout) {
	blogService.getTopic($routeParams.topicId)
	.success(function (topic, status, headers, config) {
		if(topic) {
			topic.contentHtml = $sce.trustAsHtml(MarkDownConverter.makeHtml(topic.content));
			$scope.topic = topic

			$scope.$watch('topic.contentHtml',function(newValue,oldValue, scope){
				console.log("watch")
				window.prettyPrint()
			});
		} else {
			 $location.path("/");
		}
	})
});
