{{/*
==============================================================================
KubeDiorama Helm Chart Helper Templates
==============================================================================
This file defines reusable named templates used across all chart manifests.
Placing shared logic here avoids duplication and makes values overrides clean.
==============================================================================
*/}}

{{/*
Expand the release name, truncated to 63 characters (K8s label value limit).
We truncate at 63 chars because some Kubernetes name fields are limited to this.
*/}}
{{- define "kubediorama.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a fully qualified app name combining release name + chart name.
Truncated to 63 characters. If fullnameOverride is set, use that directly.
*/}}
{{- define "kubediorama.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart label value: "chart-name-version" formatted as a Helm selector.
*/}}
{{- define "kubediorama.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels applied to ALL resources created by this chart.
These enable `kubectl get all -l app.kubernetes.io/name=kubediorama` to list
every resource belonging to this KubeDiorama installation cleanly.
*/}}
{{- define "kubediorama.labels" -}}
helm.sh/chart: {{ include "kubediorama.chart" . }}
{{ include "kubediorama.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- with .Values.commonLabels }}
{{ toYaml . }}
{{- end }}
{{- end }}

{{/*
Selector labels — used by Deployment spec.selector and Service spec.selector.
These MUST be stable across upgrades (do NOT add values that change per-release).
*/}}
{{- define "kubediorama.selectorLabels" -}}
app.kubernetes.io/name: {{ include "kubediorama.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Resolve the ServiceAccount name to use for the KubeDiorama pod.
If serviceAccount.create is false, assumes an externally-managed SA exists.
*/}}
{{- define "kubediorama.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "kubediorama.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}
