LOCAL_PATH := $(call my-dir)
include $(CLEAR_VARS)
LOCAL_PACKAGE_NAME := X704AIAssistant
LOCAL_MODULE_TAGS := optional
LOCAL_SRC_FILES := $(call all-java-files-under, src)
LOCAL_MANIFEST_FILE := AndroidManifest.xml
LOCAL_SDK_VERSION := current
LOCAL_MIN_SDK_VERSION := 30
LOCAL_JAVA_LANGUAGE_VERSION := 1.8
# A regular app: no platform key, shared system UID or privileged permission allowlist.
include $(BUILD_PACKAGE)
