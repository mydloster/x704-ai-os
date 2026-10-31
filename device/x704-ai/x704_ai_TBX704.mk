# Experimental Android 11 baseline. Physical target: Lenovo TB-X704L (LTE).
$(call inherit-product, device/lenovo/TBX704/lineage_TBX704.mk)

PRODUCT_NAME := x704_ai_TBX704
PRODUCT_MODEL := Lenovo TB-X704L

PRODUCT_PACKAGES += X704AIAssistant
PRODUCT_SYSTEM_DEFAULT_PROPERTIES += \
    ro.x704ai.version=0.1-dev \
    ro.x704ai.status=experimental \
    ro.x704ai.base=android11

# Keep the inherited legacy fingerprint, radio configuration, SELinux policy and
# partition layout for baseline comparison. This is not Play Integrity certification.
