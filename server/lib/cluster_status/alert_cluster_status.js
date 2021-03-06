import moment from 'moment';

const SEV_CRITICAL = 'critical';
const SEV_MEDIUM = 'medium';

const getSeverity = status => {
  if (status === 'red') {
    return SEV_CRITICAL;
  }
  if (status === 'yellow') {
    return SEV_MEDIUM;
  }
  return null;
};

/*
 * @param {Object} server
 * @param {Object} taskInstance - instance from the scheduled task passed to the task runner function as part of the run context
 * @param {Object} state - modeled data computed by the task runner function
 */
export async function alertClusterStatus(server, taskInstance, state) {
  const { notificationService } = server.plugins.notifications;
  const action = notificationService.getActionForId('xpack-notifications-logger');

  for (const clusterUuid of Object.keys(state)) {
    const cluster = state[clusterUuid];
    const clusterStatus = cluster.status;
    const severity = getSeverity(clusterStatus);
    state[clusterUuid].last_severity = severity;

    let result = Promise.resolve({});

    if (severity === SEV_CRITICAL || severity === SEV_MEDIUM) {
      const { cluster_name: clusterName } = cluster;
      result = action.performAction({
        task_id: taskInstance.id,
        severity,
        message: `Cluster [${clusterName} / ${clusterUuid}] status is ${clusterStatus}`,
      });
    }

    // save the time a notification action was performed, if one was
    const { error, ok: alertSuccess } = await result;
    if (error) {
      server.log(
        ['warn', 'alert', 'notification'],
        `Failure performing notification alert: ${error}`
      );
    } else if (alertSuccess) {
      state[clusterUuid].last_alerted = moment.utc().format();
    }
  }
}
