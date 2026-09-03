# Stack traces from play console are only readable through the mapping file that is built
# alongside the bundle, and only if the line numbers survive to be mapped back. The source file
# names are renamed rather than kept, so they carry nothing but the line number.
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

# The camera plugin carries its parameters and its results between the app and the editor as gson
# objects, and neither gson nor the ioncamera-android library that uses it ships rules of its own.
# Gson works over these classes by reflection: it needs the fields to still be there to fill them,
# the @SerializedName on each one to know which json key it answers to, and the generic signature
# of a TypeToken to know what it is building - none of which R8 can see is used. These are gson's
# own documented rules.
-keepattributes Signature
-dontwarn sun.misc.**
-keepclassmembers,allowobfuscation class * {
    @com.google.gson.annotations.SerializedName <fields>;
}
-keep,allowobfuscation,allowshrinking class com.google.gson.reflect.TypeToken
-keep,allowobfuscation,allowshrinking class * extends com.google.gson.reflect.TypeToken
-keep class * extends com.google.gson.TypeAdapter
-keep class * implements com.google.gson.TypeAdapterFactory
-keep class * implements com.google.gson.JsonSerializer
-keep class * implements com.google.gson.JsonDeserializer
